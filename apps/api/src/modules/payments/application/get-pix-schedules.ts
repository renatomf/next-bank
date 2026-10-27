import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import {
  type PixScheduleDetailView,
  type PixScheduleView,
  scheduleDetailViewOf,
  scheduleViewOf,
} from './pix-schedule-view.ts';
import type { AccountsPort, PaymentsRepositoriesFactory, SchedulePosition } from './ports.ts';

/** Schedules per page, as the statement (READ-04): never the client's to choose. */
const PAGE_SIZE = 20;

export interface GetPixSchedulesDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  accounts: AccountsPort;
}

/**
 * The payer's scheduled Pix (v1.2.0 plan, task 7). Only the payer reaches a
 * schedule: anyone else gets the same NotFound as for one that does not
 * exist (READ-01).
 */
export class GetPixSchedules {
  readonly #deps: GetPixSchedulesDependencies;

  constructor(deps: GetPixSchedulesDependencies) {
    this.#deps = deps;
  }

  /** Newest first; [next] is where this page ends, null on the last one. */
  async list(input: {
    userId: string;
    after: SchedulePosition | null;
  }): Promise<{ items: PixScheduleView[]; next: SchedulePosition | null }> {
    const { unitOfWork, repositories, accounts } = this.#deps;
    const schedules = await unitOfWork.run(async (tx) => {
      const payer = await accounts.findByHolder(tx, input.userId);
      if (!payer) return [];
      // One more than the page tells whether another page follows.
      return repositories.for(tx).pixSchedules.listForPayer(payer.id, input.after, PAGE_SIZE + 1);
    });
    const page = schedules.slice(0, PAGE_SIZE);
    const last = page.at(-1);
    return {
      items: page.map(scheduleViewOf),
      next:
        schedules.length > PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async get(input: { userId: string; scheduleId: string }): Promise<PixScheduleDetailView> {
    const { unitOfWork, repositories, accounts } = this.#deps;
    const found = await unitOfWork.run(async (tx) => {
      const payer = await accounts.findByHolder(tx, input.userId);
      const schedules = repositories.for(tx).pixSchedules;
      const schedule = payer && (await schedules.findForPayer(input.scheduleId, payer.id));
      return schedule
        ? { schedule, occurrences: await schedules.occurrencesOf(schedule.id) }
        : null;
    });
    if (!found) throw new NotFound('Pix schedule');
    return scheduleDetailViewOf(found.schedule, found.occurrences);
  }
}
