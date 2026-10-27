import type { ErrorReporter } from '../../../shared/application/ports.ts';
import type { DivergenceAlarm } from '../application/ports.ts';
import type { DivergenceKind } from '../domain/reconciliation.ts';

/** A day the reconciliation found divergences in: its message names no Pix. */
class ReconciliationDivergences extends Error {
  override name = 'ReconciliationDivergences';
}

/**
 * Tells a person a day had divergences through the error reporter (Sentry),
 * once per day, with the date and the counts only (v1.2.0 plan, task 6, R4):
 * the details stay in the database, for the backoffice (API-04).
 */
export class ErrorReporterAlarm implements DivergenceAlarm {
  readonly #reporter: ErrorReporter;

  constructor(reporter: ErrorReporter) {
    this.#reporter = reporter;
  }

  raise(runDate: string, counts: Partial<Record<DivergenceKind, number>>): void {
    const summary = Object.entries(counts)
      .map(([kind, count]) => `${kind} ${String(count)}`)
      .join(', ');
    this.#reporter.report(
      new ReconciliationDivergences(`Reconciliation of ${runDate} found divergences: ${summary}`),
      { requestId: `reconciliation-${runDate}`, method: 'JOB', route: 'reconciliation' },
    );
  }
}
