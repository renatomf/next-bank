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
import { Money } from '../../../shared/domain/money.ts';
import {
  AccountBlocked,
  type AuthorizationRefusal,
  PixAuthorizationRefused,
  PixKeyNotFound,
  TooManyKeyLookups,
} from '../domain/errors.ts';
import type { PixKeyType } from '../domain/pix-key.ts';
import { PixSchedule, type ScheduleRecurrence } from '../domain/pix-schedule.ts';
import { normalized, resolvePayee } from './find-payee.ts';
import { type PixScheduleView, scheduleViewOf } from './pix-schedule-view.ts';
import type {
  AccountsPort,
  IdentityPort,
  KeyLookupQuota,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
  SpiPort,
} from './ports.ts';

export interface CreatePixScheduleInput {
  /** From the verified access token: the payer is never taken from the body (PIX-01). */
  userId: string;
  sessionId: string;
  idempotencyKey: string;
  key: { type: PixKeyType; value: string };
  /** Integer cents, already checked at the edge (D1). */
  amountCents: number;
  description: string | null;
  /** A day of São Paulo, YYYY-MM-DD. */
  firstDate: string;
  recurrence: ScheduleRecurrence;
  pin: string;
  requestId: string | null;
}

export interface CreatePixScheduleDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  fingerprint: RequestFingerprint;
  accounts: AccountsPort;
  identity: IdentityPort;
  quota: KeyLookupQuota;
  clock: Clock;
  ids: IdGenerator;
  /** The DICT; null while the Pix to other banks is off (P1). */
  spi: SpiPort | null;
}

/** A missing key costs one more lookup, as in the key lookup (PIX-07). */
const MISS_PENALTY = 1;

/** Status of a stored refusal: what was recorded is answered as the catalog error. */
const REFUSED = 0;

interface Refusal {
  code: AuthorizationRefusal;
  details: Record<string, number>;
}

/**
 * Schedules a Pix (v1.2.0 plan, task 7): the PIN checked on the server now
 * authorizes every occurrence (D10), once per idempotency key (ADR 0007). The
 * schedule is checked before the PIN, so a malformed one costs no attempt;
 * the balance is not, because the one of each occurrence's day counts.
 */
export class CreatePixSchedule {
  readonly #deps: CreatePixScheduleDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CreatePixScheduleDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(input: CreatePixScheduleInput): Promise<PixScheduleView> {
    const now = this.#deps.clock.now();
    // The answer names the payee, so scheduling spends the lookup quota (PIX-07).
    if (!this.#deps.quota.tryTake(input.userId, 1, now)) throw new TooManyKeyLookups();

    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: input.userId,
          key: input.idempotencyKey,
          operation: 'pix.schedule',
          // Never the PIN (D4): the same key with another PIN gets the first answer.
          payload: {
            key: { type: input.key.type, value: normalized(input.key.type, input.key.value) },
            amountCents: input.amountCents,
            description: input.description,
            firstDate: input.firstDate,
            recurrence: input.recurrence,
          },
          now,
        },
        () => this.#schedule(tx, repositories, input, now),
      );
    });
    // Committed already: a refusal is answered only after the attempt is saved.
    if (response.status === REFUSED) {
      const refusal = response.body as Refusal;
      throw new PixAuthorizationRefused(refusal.code, refusal.details);
    }
    return response.body as PixScheduleView;
  }

  async #schedule(
    tx: Transaction,
    repositories: PaymentsRepositories,
    input: CreatePixScheduleInput,
    now: Date,
  ): Promise<StoredResponse> {
    const { accounts, identity, quota, ids } = this.#deps;
    const payer = await accounts.findByHolder(tx, input.userId);
    if (payer === null) throw new Error(`Customer ${input.userId} has no account`);
    if (payer.status !== 'ACTIVE') throw new AccountBlocked();

    const resolved = await resolvePayee(this.#deps, tx, repositories, input.key);
    if (resolved === null) {
      quota.charge(input.userId, MISS_PENALTY, now);
      throw new PixKeyNotFound();
    }
    const schedule = PixSchedule.create({
      id: ids.next(),
      payerAccountId: payer.id,
      payee: resolved.payee,
      amount: Money.of(BigInt(input.amountCents)),
      description: input.description,
      firstDate: input.firstDate,
      recurrence: input.recurrence,
      now,
    });

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

    await repositories.pixSchedules.insert(schedule.state, resolved.payeeKey);
    await repositories.audit.record({
      id: ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.userId,
      action: 'PIX_SCHEDULE_CREATED',
      subjectType: 'PIX_SCHEDULE',
      subjectId: schedule.state.id,
      requestId: input.requestId,
      metadata: {
        sessionId: input.sessionId,
        amountCents: input.amountCents,
        keyType: input.key.type,
        frequency: input.recurrence.frequency,
        times: schedule.times,
      },
    });
    return { status: 201, body: scheduleViewOf(schedule.state) };
  }
}

function refused(code: AuthorizationRefusal, details: Record<string, number> = {}): StoredResponse {
  return { status: REFUSED, body: { code, details } satisfies Refusal };
}
