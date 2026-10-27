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
import type { PixKeyType } from '../domain/pix-key.ts';
import { Idempotency, type RequestFingerprint } from '../../../shared/application/idempotency.ts';
import { PixTransfer } from '../domain/pix-transfer.ts';
import { normalized, resolvePayee } from './find-payee.ts';
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
    const { accounts, ledger, quota, ids } = this.#deps;
    const payer = await accounts.findByHolder(tx, input.userId);
    if (payer === null) throw new Error(`Customer ${input.userId} has no account`);
    if (payer.status !== 'ACTIVE') throw new AccountBlocked();

    // The DICT is asked here, after the idempotency claim, so a repeated
    // request gets the stored answer without asking again (ADR 0007).
    const resolved = await resolvePayee(this.#deps, tx, repositories, input.key);
    if (resolved === null) {
      quota.charge(input.userId, MISS_PENALTY, now);
      throw new PixKeyNotFound();
    }

    const amount = Money.of(BigInt(input.amountCents));
    const transfer = PixTransfer.create({
      id: ids.next(),
      payerAccountId: payer.id,
      payee: resolved.payee,
      amount,
      description: input.description,
      now,
    });
    const balance = await ledger.availableBalance(tx, payer.id);
    if (balance === null) throw new Error(`Account ${payer.id} has no ledger account`);
    if (balance.isLessThan(amount)) throw new InsufficientFunds();

    await repositories.pixTransfers.insert(transfer.state, resolved.payeeKey);
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
