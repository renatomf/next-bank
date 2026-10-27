// Public API of the reconciliation context: only what is exported here is
// used outside it (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import type {
  ClearingBalance,
  DivergenceAlarm,
  ExternalPixReader,
  SettlementFiles,
} from './application/ports.ts';
import { ReconcileDay } from './application/reconcile-day.ts';
import { PgReconciliationRepositories } from './infrastructure/pg-reconciliation-repository.ts';

export { ErrorReporterAlarm } from './infrastructure/error-reporter-alarm.ts';

export type { ReconcileDay } from './application/reconcile-day.ts';
export type {
  ClearingBalance,
  DivergenceAlarm,
  ExternalPixReader,
  SettlementFiles,
} from './application/ports.ts';

export interface ReconciliationModule {
  reconcileDay: ReconcileDay;
}

/** Builds the reconciliation context with its production adapters (v1.2.0 plan, task 6). */
export function createReconciliationModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  files: SettlementFiles;
  pix: ExternalPixReader;
  clearing: ClearingBalance;
  alarm: DivergenceAlarm;
}): ReconciliationModule {
  return {
    reconcileDay: new ReconcileDay({
      unitOfWork: settings.unitOfWork,
      repositories: new PgReconciliationRepositories(settings.ids),
      files: settings.files,
      pix: settings.pix,
      clearing: settings.clearing,
      alarm: settings.alarm,
      clock: settings.clock,
    }),
  };
}
