import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The daily reconciliation (v1.2.0 plan, task 6; EXT-04): a run per day,
// reserved so two instances never reconcile the same day at once, and the
// exceptions it finds, recorded once per day, kind and Pix, never changed
// nor deleted by the API (R5).
describe('reconciliation schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  let nextDay = 0;
  /** A day of its own for each test: runs and exceptions are per day. */
  const day = () => `2025-01-${String(++nextDay).padStart(2, '0')}`;

  function reserve(runDate: string) {
    return app.query(
      `INSERT INTO reconciliation.runs (run_date, status, started_at)
       VALUES ($1, 'RUNNING', now()) ON CONFLICT (run_date) DO NOTHING`,
      [runDate],
    );
  }

  function record(
    runDate: string,
    kind: string,
    endToEndId: string | null,
    cents: { expected?: number; actual?: number } = {},
  ) {
    return app.query(
      `INSERT INTO reconciliation.exceptions
         (id, run_date, kind, end_to_end_id, expected_cents, actual_cents, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [randomUUID(), runDate, kind, endToEndId, cents.expected ?? null, cents.actual ?? null],
    );
  }

  it('reserves a day once: a second reservation inserts nothing', async () => {
    const runDate = day();

    expect((await reserve(runDate)).rowCount).toBe(1);
    expect((await reserve(runDate)).rowCount).toBe(0);
  });

  it('finishes a run with its counts', async () => {
    const runDate = day();
    await reserve(runDate);

    const done = await app.query(
      `UPDATE reconciliation.runs
       SET status = 'DONE', finished_at = now(), payments_checked = 3, exceptions_found = 1
       WHERE run_date = $1`,
      [runDate],
    );

    expect(done.rowCount).toBe(1);
  });

  it('refuses a finished run without its end, or an unknown status', async () => {
    await expect(
      app.query(
        `INSERT INTO reconciliation.runs (run_date, status, started_at)
         VALUES ($1, 'DONE', now())`,
        [day()],
      ),
    ).rejects.toThrow(/check/);
    await expect(
      app.query(
        `INSERT INTO reconciliation.runs (run_date, status, started_at)
         VALUES ($1, 'MAYBE', now())`,
        [day()],
      ),
    ).rejects.toThrow(/check/);
  });

  it('records an exception once per day, kind and Pix, even with no Pix', async () => {
    const runDate = day();
    await record(runDate, 'MISSING_HERE', 'E00000000202501011200a1B2c3D4e5F');
    await record(runDate, 'CLEARING_MISMATCH', null, { expected: 1000, actual: 900 });

    await expect(
      record(runDate, 'MISSING_HERE', 'E00000000202501011200a1B2c3D4e5F'),
    ).rejects.toThrow(/exceptions_run_date_kind_end_to_end_id_key/);
    await expect(
      record(runDate, 'CLEARING_MISMATCH', null, { expected: 1000, actual: 900 }),
    ).rejects.toThrow(/exceptions_run_date_kind_end_to_end_id_key/);
  });

  it('refuses an unknown kind', async () => {
    await expect(record(day(), 'SOMETHING', null)).rejects.toThrow(/check/);
  });

  it('never lets the API change or delete an exception, nor delete a run (R5)', async () => {
    const runDate = day();
    await reserve(runDate);
    await record(runDate, 'STALE_PROCESSING', 'E00000000202501011200zzzzzzzzzzz');

    for (const statement of [
      "UPDATE reconciliation.exceptions SET kind = 'MISSING_HERE' WHERE run_date = $1",
      'DELETE FROM reconciliation.exceptions WHERE run_date = $1',
      'DELETE FROM reconciliation.runs WHERE run_date = $1',
      'UPDATE reconciliation.runs SET run_date = run_date WHERE run_date = $1',
    ]) {
      await expect(app.query(statement, [runDate])).rejects.toThrow(/permission denied/);
    }
  });
});
