import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { PixSchedule, saoPauloDate } from '../domain/pix-schedule.ts';
import { PixTransfer } from '../domain/pix-transfer.ts';
import { isDaytime } from '../domain/transfer-limits.ts';
import type { PaymentsRepositoriesFactory, SealedKeyValue } from './ports.ts';
import { processPix, type ProcessPixDependencies } from './process-pix.ts';

export interface RunDueSchedulesDependencies extends ProcessPixDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
}

/** Occurrences per round: the round never holds the instance for long (v1.2.0 plan, task 7). */
const OCCURRENCES_PER_ROUND = 20;

/**
 * The worker of the scheduled Pix (v1.2.0 plan, task 7), run by the API's
 * process every minute (D3). Each occurrence due is paid once, in a
 * transaction of its own, with the schedule locked first (EXT-05) and the
 * PIN given when scheduling (D10); paid or failed, the schedule moves on in
 * the same transaction (S5).
 */
export class RunDueSchedules {
  readonly #deps: RunDueSchedulesDependencies;

  constructor(deps: RunDueSchedulesDependencies) {
    this.#deps = deps;
  }

  /**
   * Pays what is due now and answers how many occurrences ran. A technical
   * failure undoes that occurrence alone: the round goes on without it, and
   * then throws, so the failure is logged and the next round tries again.
   */
  async runOnce(): Promise<number> {
    const now = this.#deps.clock.now();
    // S3: only in the daytime of São Paulo, so the daytime limit holds.
    if (!isDaytime(now)) return 0;
    const today = saoPauloDate(now);
    // Each schedule once per round (S4), paid or failed: a late one never
    // pays two dates in a round, and a failed one waits for the next.
    const handled: string[] = [];
    const failures: Error[] = [];
    let ran = 0;
    while (ran < OCCURRENCES_PER_ROUND) {
      const attempt = await this.#payOne(today, handled, now);
      if (attempt === null) break;
      handled.push(attempt.scheduleId);
      if (attempt.failure) failures.push(attempt.failure);
      else ran += 1;
    }
    if (failures[0]) throw failures[0];
    return ran;
  }

  /** The next schedule due, paid in a transaction of its own; null when none is due. */
  async #payOne(
    today: string,
    handled: readonly string[],
    now: Date,
  ): Promise<{ scheduleId: string; failure?: Error } | null> {
    const locked: { scheduleId?: string } = {};
    try {
      const paid = await this.#deps.unitOfWork.run(async (tx) => {
        const due = await this.#deps.repositories.for(tx).pixSchedules.lockNextDue(today, handled);
        if (due === null) return false;
        locked.scheduleId = due.schedule.id;
        return this.#payNext(tx, PixSchedule.restore(due.schedule), due.payeeKey, now);
      });
      return paid && locked.scheduleId ? { scheduleId: locked.scheduleId } : null;
    } catch (error) {
      if (!locked.scheduleId) throw error;
      const failure = error instanceof Error ? error : new Error(String(error));
      return { scheduleId: locked.scheduleId, failure };
    }
  }

  /** Pays the schedule's next occurrence, or answers false when it is not due. */
  async #payNext(
    tx: Transaction,
    schedule: PixSchedule,
    payeeKey: SealedKeyValue | null,
    now: Date,
  ): Promise<boolean> {
    const sequence = schedule.dueSequence(now);
    if (sequence === null) return false;
    const { accounts, ids } = this.#deps;
    const repositories = this.#deps.repositories.for(tx);
    const { state } = schedule;
    const payer = await accounts.findById(tx, state.payerAccountId);
    if (payer === null) throw new Error(`Schedule ${state.id} has no payer account`);

    const transfer = PixTransfer.create({
      id: ids.next(),
      payerAccountId: state.payerAccountId,
      payee: state.payee,
      amount: state.amount,
      description: state.description,
      now,
    });
    await processPix(this.#deps, tx, transfer, payer, now, null);
    await repositories.pixTransfers.insert(transfer.state, payeeKey ?? undefined);
    await repositories.pixSchedules.recordOccurrence({
      id: ids.next(),
      scheduleId: state.id,
      sequence,
      occurrenceDate: schedule.occurrenceDate(sequence),
      transferId: transfer.state.id,
      executedAt: now,
    });
    schedule.advance(sequence, now);
    await repositories.pixSchedules.update(schedule.state);

    const paid = transfer.state;
    const failed = paid.status === 'FAILED';
    await repositories.audit.record({
      id: ids.next(),
      occurredAt: now,
      actorType: 'SYSTEM',
      actorId: null,
      // Sent: on its way to another bank, which answers later (task 4).
      action: failed ? 'PIX_FAILED' : paid.status === 'COMPLETED' ? 'PIX_COMPLETED' : 'PIX_SENT',
      subjectType: 'PIX_TRANSFER',
      subjectId: paid.id,
      requestId: null,
      metadata: failed
        ? { scheduleId: state.id, sequence, reason: paid.failureReason ?? '' }
        : {
            scheduleId: state.id,
            sequence,
            amountCents: paid.amount.toJsonAmount(),
            endToEndId: paid.endToEndId ?? '',
          },
    });
    return true;
  }
}
