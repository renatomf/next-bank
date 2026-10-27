import { describe, expect, it } from 'vitest';
import { ErrorReporterAlarm } from '../../../../src/modules/reconciliation/infrastructure/error-reporter-alarm.ts';
import type { ReportedRequest } from '../../../../src/shared/application/ports.ts';

// A day with divergences reaches a person through the error reporter
// (Sentry) with the date and the counts only (v1.2.0 plan, task 6, R4):
// never an end-to-end id, an amount or anyone's name (API-04).
describe('ErrorReporterAlarm', () => {
  it('reports the day and how many divergences of each kind', () => {
    const reported: { error: unknown; request: ReportedRequest }[] = [];
    const alarm = new ErrorReporterAlarm({
      report: (error, request) => reported.push({ error, request }),
    });

    alarm.raise('2026-10-26', { MISSING_HERE: 2, CLEARING_MISMATCH: 1 });

    const [only] = reported;
    expect(reported).toHaveLength(1);
    expect(only?.error).toBeInstanceOf(Error);
    expect((only?.error as Error).message).toBe(
      'Reconciliation of 2026-10-26 found divergences: MISSING_HERE 2, CLEARING_MISMATCH 1',
    );
    expect(only?.request).toEqual({
      requestId: 'reconciliation-2026-10-26',
      method: 'JOB',
      route: 'reconciliation',
    });
  });
});
