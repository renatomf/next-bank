import {
  Idempotency,
  type RequestFingerprint,
  type StoredResponse,
} from '../../../shared/application/idempotency.ts';
import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { assertWithinDailyLimit, startOfDayInSaoPaulo } from '../domain/daily-limit.ts';
import { AccountBlocked, type TopUpRefusal, TopUpRefused } from '../domain/errors.ts';
import { assertOfferedAmount, operatorById, type TopUpOperator } from '../domain/operator.ts';
import { PhoneNumber } from '../domain/phone-number.ts';
import type {
  AccountsPort,
  IdentityPort,
  LedgerPort,
  PhoneProtector,
  TopUpProvider,
  TopUpsRepositories,
  TopUpsRepositoriesFactory,
  TopUpState,
} from './ports.ts';
import { type TopUpView, viewOf } from './top-up-view.ts';

export interface CreateTopUpInput {
  /** From the verified access token: the payer is never taken from the request. */
  userId: string;
  idempotencyKey: string;
  operatorId: string;
  phoneNumber: string;
  amount: Money;
  pin: string;
  requestId: string | null;
}

export interface CreateTopUpDependencies {
  unitOfWork: UnitOfWork;
  repositories: TopUpsRepositoriesFactory;
  fingerprint: RequestFingerprint;
  accounts: AccountsPort;
  identity: IdentityPort;
  ledger: LedgerPort;
  provider: TopUpProvider;
  protector: PhoneProtector;
  clock: Clock;
  ids: IdGenerator;
}

/** Status of a stored refusal: what was recorded is answered as the catalog error. */
const REFUSED = 0;

interface Refusal {
  code: TopUpRefusal;
  details: Record<string, number>;
}

/**
 * Tops up a phone (v1.1.0 plan, task 5): the PIN checked on the server
 * (ADR 0004), once per idempotency key (ADR 0007), in one transaction with
 * the locks in the order of database.md section 7: the PIN, the account for
 * share and the customer's ledger account. The day's total is read after
 * that lock, so two top-ups of one customer cannot both pass the limit. The
 * money is posted before the operator is asked; if the operator fails, the
 * transaction undoes the posting (D5).
 */
export class CreateTopUp {
  readonly #deps: CreateTopUpDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CreateTopUpDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(input: CreateTopUpInput): Promise<TopUpView> {
    // Checked before any state: a malformed request costs nothing and counts no PIN.
    const operator = operatorById(input.operatorId);
    assertOfferedAmount(input.amount);
    const phone = PhoneNumber.parse(input.phoneNumber);
    const now = this.#deps.clock.now();

    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: input.userId,
          key: input.idempotencyKey,
          operation: 'top-up.create',
          // Never the PIN (D4): the same key with another PIN gets the first answer.
          payload: {
            operatorId: operator.id,
            phone: phone.digits,
            amountCents: input.amount.cents.toString(),
          },
          now,
        },
        () => this.#topUp(tx, repositories, input, operator, phone, now),
      );
    });
    // Committed already: a refusal is answered only after the attempt is saved.
    if (response.status === REFUSED) {
      const refusal = response.body as Refusal;
      throw new TopUpRefused(refusal.code, refusal.details);
    }
    return response.body as TopUpView;
  }

  async #topUp(
    tx: Transaction,
    repositories: TopUpsRepositories,
    input: CreateTopUpInput,
    operator: TopUpOperator,
    phone: PhoneNumber,
    now: Date,
  ): Promise<StoredResponse> {
    const { accounts, identity, ledger, provider, protector, ids } = this.#deps;
    const account = await accounts.findByHolder(tx, input.userId);
    if (!account) throw new NotFound('Account');

    const pin = await identity.verifyPin(tx, {
      userId: input.userId,
      pin: input.pin,
      requestId: input.requestId,
    });
    switch (pin.outcome) {
      case 'INCORRECT':
        return refused('PinIncorrect', { remainingAttempts: pin.remainingAttempts });
      case 'LOCKED':
        return refused('PinLocked');
      case 'RESET_REQUIRED':
        return refused('PinResetRequired');
      case 'VERIFIED':
        break;
    }

    const locked = await accounts.lockForShare(tx, account.id);
    if (locked.status !== 'ACTIVE') throw new AccountBlocked();
    await ledger.lockCustomerAccount(tx, account.id);
    const spentToday = await repositories.topUps.spentSince(account.id, startOfDayInSaoPaulo(now));
    assertWithinDailyLimit(spentToday, input.amount);

    const id = ids.next();
    await ledger.postTopUp(tx, {
      topUpId: id,
      accountId: account.id,
      operatorId: operator.id,
      amount: input.amount,
      counterparty: { name: operator.name, documentMasked: phone.masked },
    });
    const { reference } = await provider.recharge({
      topUpId: id,
      operatorId: operator.id,
      phoneDigits: phone.digits,
      amount: input.amount,
    });

    const state: TopUpState = {
      id,
      accountId: account.id,
      operatorId: operator.id,
      phoneMasked: phone.masked,
      amount: input.amount,
      status: 'COMPLETED',
      providerReference: reference,
      createdAt: now,
    };
    await repositories.topUps.insert(state, protector.protect(phone.digits));
    // The number never reaches the audit trail (MOB-02).
    await repositories.audit.record({
      id: ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.userId,
      action: 'TOP_UP_COMPLETED',
      subjectType: 'TOP_UP',
      subjectId: id,
      requestId: input.requestId,
      metadata: { operatorId: operator.id, amountCents: input.amount.toJsonAmount() },
    });
    return { status: 201, body: viewOf(state) };
  }
}

function refused(code: TopUpRefusal, details: Record<string, number> = {}): StoredResponse {
  const body: Refusal = { code, details };
  return { status: REFUSED, body };
}
