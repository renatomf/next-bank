import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import {
  AccountBlocked,
  InsufficientFunds,
  PixKeyNotFound,
  TooManyKeyLookups,
} from '../domain/errors.ts';
import { type PixKeyType, pixKeyValue } from '../domain/pix-key.ts';
import { Idempotency, type RequestFingerprint } from '../../../shared/application/idempotency.ts';
import { type PixPayee, PixTransfer } from '../domain/pix-transfer.ts';
import {
  findPayeeElsewhere,
  findPayeeHere,
  type PayeeElsewhere,
  type PayeeHere,
} from './find-payee.ts';
import type { PixTransferView } from './pix-transfer-view.ts';
import { viewOf } from './pix-transfer-view.ts';
import type {
  AccountsPort,
  IdentityPort,
  KeyLookupQuota,
  LedgerPort,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
  SealedKeyValue,
  SpiPort,
} from './ports.ts';

export interface CreatePixTransferInput {
  /** From the verified access token: the payer is never taken from the body (PIX-01). */
  userId: string;
  sessionId: string;
  idempotencyKey: string;
  key: { type: PixKeyType; value: string };
  /** Integer cents, already checked at the edge (D1). */
  amountCents: number;
  description: string | null;
  requestId: string | null;
}

export interface CreatePixTransferDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  fingerprint: RequestFingerprint;
  accounts: AccountsPort;
  identity: IdentityPort;
  ledger: LedgerPort;
  quota: KeyLookupQuota;
  clock: Clock;
  ids: IdGenerator;
  /** The DICT; null while the Pix to other banks is off (P1). */
  spi: SpiPort | null;
}

/** A missing key costs one more lookup, as in the key lookup (PIX-07). */
const MISS_PENALTY = 1;

/**
 * Creates a Pix awaiting the PIN (domain-model.md 4), once per idempotency key
 * (ADR 0007). Balance and limit are checked early here and again at
 * authorization, which is what counts.
 */
export class CreatePixTransfer {
  readonly #deps: CreatePixTransferDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CreatePixTransferDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(input: CreatePixTransferInput): Promise<{ status: number; body: PixTransferView }> {
    const now = this.#deps.clock.now();
    // The answer names the payee, so creating spends the lookup quota (PIX-07, F-11).
    if (!this.#deps.quota.tryTake(input.userId, 1, now)) throw new TooManyKeyLookups();

    const payload = {
      key: { type: input.key.type, value: normalized(input.key.type, input.key.value) },
      amountCents: input.amountCents,
      description: input.description,
    };
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        { userId: input.userId, key: input.idempotencyKey, operation: 'pix.create', payload, now },
        () => this.#create(tx, repositories, input, now),
      );
    });
    return response as { status: number; body: PixTransferView };
  }

  async #create(
    tx: Transaction,
    repositories: PaymentsRepositories,
    input: CreatePixTransferInput,
    now: Date,
  ): Promise<{ status: number; body: PixTransferView }> {
    const { accounts, ledger, quota, protector, ids } = this.#deps;
    const payer = await accounts.findByHolder(tx, input.userId);
    if (payer === null) throw new Error(`Customer ${input.userId} has no account`);
    if (payer.status !== 'ACTIVE') throw new AccountBlocked();

    const value = normalized(input.key.type, input.key.value);
    const key = value === null ? null : { type: input.key.type, value };
    // The DICT is asked here, after the idempotency claim, so a repeated
    // request gets the stored answer without asking again (ADR 0007); the
    // client's short deadline bounds how long the transaction waits for it.
    const payee =
      key &&
      ((await findPayeeHere(this.#deps, tx, repositories, key)) ??
        (await findPayeeElsewhere(this.#deps.spi, key)));
    if (key === null || payee === null) {
      quota.charge(input.userId, MISS_PENALTY, now);
      throw new PixKeyNotFound();
    }

    const amount = Money.of(BigInt(input.amountCents));
    const transfer = PixTransfer.create({
      id: ids.next(),
      payerAccountId: payer.id,
      payee: snapshotOf(payee, input.key.type),
      amount,
      description: input.description,
      now,
    });
    const balance = await ledger.availableBalance(tx, payer.id);
    if (balance === null) throw new Error(`Account ${payer.id} has no ledger account`);
    if (balance.isLessThan(amount)) throw new InsufficientFunds();

    await repositories.pixTransfers.insert(
      transfer.state,
      'bank' in payee ? sealed(protector.protect(key.type, key.value)) : undefined,
    );
    await repositories.audit.record({
      id: ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.userId,
      action: 'PIX_CREATED',
      subjectType: 'PIX_TRANSFER',
      subjectId: transfer.state.id,
      requestId: input.requestId,
      metadata: {
        sessionId: input.sessionId,
        amountCents: input.amountCents,
        keyType: input.key.type,
      },
    });
    return { status: 201, body: viewOf(transfer.state) };
  }
}

/** Who receives, as the Pix keeps it: a next bank account or another bank (P3). */
function snapshotOf(payee: PayeeHere | PayeeElsewhere, keyType: PixKeyType): PixPayee {
  const shown = { name: payee.name, documentMasked: payee.documentMasked, keyType };
  return 'bank' in payee
    ? { ...shown, accountId: null, bank: payee.bank, keyMasked: payee.keyMasked }
    : { ...shown, accountId: payee.accountId, keyMasked: payee.keyMasked };
}

/** Only what decrypting needs: the blind index finds keys of next bank, not this one. */
function sealed({ ciphertext, keyVersion }: SealedKeyValue): SealedKeyValue {
  return { ciphertext, keyVersion };
}

/** The key as stored, or null when no key can have this value. */
function normalized(type: PixKeyType, raw: string): string | null {
  try {
    return pixKeyValue(type, raw);
  } catch {
    return null;
  }
}
