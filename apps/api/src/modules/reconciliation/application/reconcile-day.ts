import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import {
  dayToReconcile,
  type DivergenceKind,
  findDivergences,
  saoPauloDay,
} from '../domain/reconciliation.ts';
import type {
  ClearingBalance,
  DivergenceAlarm,
  ExternalPixReader,
  ReconciliationRepositoryFactory,
  SettlementFiles,
} from './ports.ts';

export interface ReconcileDayDependencies {
  unitOfWork: UnitOfWork;
  repositories: ReconciliationRepositoryFactory;
  files: SettlementFiles;
  pix: ExternalPixReader;
  clearing: ClearingBalance;
  alarm: DivergenceAlarm;
  clock: Clock;
}

export type ReconcileDayResult =
  { status: 'RECONCILED'; divergences: number } | { status: 'SKIPPED' };

/** A run left RUNNING this long ago belongs to an instance that died; it is taken again. */
const RUN_TIMEOUT_MS = 30 * 60_000;
/** A Pix waiting for the SPI longer than this needs a person (R2). */
const STALE_AFTER_MS = 24 * 60 * 60_000;

/**
 * Reconciles one day of São Paulo (v1.2.0 plan, task 6; EXT-04): the SPI's
 * settlement files against next bank's Pix and ledger. The day is reserved
 * first, so two instances never reconcile it at once; the files are read
 * with no transaction open; next bank's side is read in one snapshot, and
 * the divergences are recorded with the run's end, in one transaction, so a
 * day is either done with all its exceptions or not done at all. Nothing
 * here moves money (D6): a person resolves each exception (D7).
 */
export class ReconcileDay {
  readonly #deps: ReconcileDayDependencies;

  constructor(deps: ReconcileDayDependencies) {
    this.#deps = deps;
  }

  /** Reconciles the day due now (R3): yesterday in São Paulo, from 03:00. */
  reconcileDueDay(): Promise<ReconcileDayResult> {
    return this.execute(dayToReconcile(this.#deps.clock.now()));
  }

  async execute(runDate: string): Promise<ReconcileDayResult> {
    const { unitOfWork, repositories, files, pix, clearing, clock } = this.#deps;
    const now = clock.now();
    const reserved = await unitOfWork.run((tx) =>
      repositories.for(tx).reserve(runDate, now, new Date(now.getTime() - RUN_TIMEOUT_MS)),
    );
    if (!reserved) return { status: 'SKIPPED' };

    const day = saoPauloDay(runDate);
    const settledOnDay = await files.fileOf(runDate);
    const settledDayBefore = await files.fileOf(day.dayBefore);

    const divergences = await unitOfWork.run(async (tx) => {
      const repository = repositories.for(tx);
      await repository.readOneSnapshot();
      const found = findDivergences({
        settledOnDay,
        settledDayBefore,
        ours: await pix.byEndToEndIds(
          tx,
          settledOnDay.map((payment) => payment.endToEndId),
        ),
        completedOnDay: await pix.completedBetween(tx, day.start, day.end),
        stale: await pix.waitingSince(tx, new Date(day.start.getTime() - STALE_AFTER_MS)),
        clearing: { balance: await clearing.of(tx), processingSum: await pix.waitingSum(tx) },
      });
      await repository.record(runDate, found, now);
      await repository.finish(runDate, now, settledOnDay.length, found.length);
      return found;
    });

    if (divergences.length > 0) {
      const counts: Partial<Record<DivergenceKind, number>> = {};
      for (const { kind } of divergences) counts[kind] = (counts[kind] ?? 0) + 1;
      this.#deps.alarm.raise(runDate, counts);
    }
    return { status: 'RECONCILED', divergences: divergences.length };
  }
}
