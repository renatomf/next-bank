import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { PixSchedule } from '../domain/pix-schedule.ts';
import { type PixScheduleView, scheduleViewOf } from './pix-schedule-view.ts';
import type { AccountsPort, PaymentsRepositoriesFactory } from './ports.ts';

export interface CancelPixScheduleInput {
  /** From the verified access token: never the request's (READ-01). */
  userId: string;
  sessionId: string;
  scheduleId: string;
  requestId: string | null;
}

export interface CancelPixScheduleDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  accounts: AccountsPort;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Cancels a scheduled Pix by its owner (v1.2.0 plan, task 7, S6). The
 * schedule is locked as the worker locks it, so a cancel during an
 * occurrence waits for it, and no occurrence runs after (EXT-06). No PIN and
 * no idempotency key: it only turns off what was authorized, and cancelling
 * again answers the same.
 */
export class CancelPixSchedule {
  readonly #deps: CancelPixScheduleDependencies;

  constructor(deps: CancelPixScheduleDependencies) {
    this.#deps = deps;
  }

  async execute(input: CancelPixScheduleInput): Promise<PixScheduleView> {
    const { unitOfWork, repositories, accounts, clock, ids } = this.#deps;
    const now = clock.now();
    return unitOfWork.run(async (tx) => {
      const payer = await accounts.findByHolder(tx, input.userId);
      const payments = repositories.for(tx);
      const state = payer && (await payments.pixSchedules.lockForPayer(input.scheduleId, payer.id));
      if (!state) throw new NotFound('Pix schedule');
      const schedule = PixSchedule.restore(state);
      if (schedule.cancel(now)) {
        await payments.pixSchedules.update(schedule.state);
        await payments.audit.record({
          id: ids.next(),
          occurredAt: now,
          actorType: 'USER',
          actorId: input.userId,
          action: 'PIX_SCHEDULE_CANCELLED',
          subjectType: 'PIX_SCHEDULE',
          subjectId: state.id,
          requestId: input.requestId,
          metadata: { sessionId: input.sessionId },
        });
      }
      return scheduleViewOf(schedule.state);
    });
  }
}
