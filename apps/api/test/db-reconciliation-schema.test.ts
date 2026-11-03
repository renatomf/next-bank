import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl, testMigrationDatabaseUrl } from './helpers.ts';

// The daily reconciliation (v1.2.0 plan, task 6; EXT-04): a run per day,
// reserved so two instances never reconcile the same day at once, and the
// exceptions it finds, recorded once per day, kind and Pix, never changed
// nor deleted by the API (R5).
describe('reconciliation schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });
  const owner = new pg.Client({ connectionString: testMigrationDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
    await owner.connect();
  });
  afterAll(async () => {
    await app.end();
    await owner.end();
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

  async function record(
    runDate: string,
    kind: string,
    endToEndId: string | null,
    cents: { expected?: number; actual?: number } = {},
  ): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO reconciliation.exceptions
         (id, run_date, kind, end_to_end_id, expected_cents, actual_cents, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [id, runDate, kind, endToEndId, cents.expected ?? null, cents.actual ?? null],
    );
    return id;
  }

  function resolve(exceptionId: string, overrides: Record<string, unknown> = {}) {
    const resolution = {
      outcome: 'EXPLAINED',
      approval_request_id: null,
      explanation: 'Checked with the SPI: the payment was returned.',
      ...overrides,
    };
    return app.query(
      `INSERT INTO reconciliation.resolutions
         (exception_id, outcome, approval_request_id, explanation, resolved_by, resolved_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        exceptionId,
        resolution.outcome,
        resolution.approval_request_id,
        resolution.explanation,
        randomUUID(),
      ],
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

  // v1.3.0 plan, task 6: the staff resolves an exception in a record of its own.
  it('lets the API lock an exception, and still never change it, not even the owner (R5)', async () => {
    const id = await record(day(), 'STALE_PROCESSING', 'E00000000202501011200lockedxxxxx');

    await app.query('BEGIN');
    try {
      await expect(
        app.query('SELECT id FROM reconciliation.exceptions WHERE id = $1 FOR UPDATE', [id]),
      ).resolves.toBeDefined();
    } finally {
      await app.query('ROLLBACK');
    }
    await expect(
      app.query('UPDATE reconciliation.exceptions SET id = id WHERE id = $1', [id]),
    ).rejects.toThrow(/append-only/);
    for (const statement of [
      "UPDATE reconciliation.exceptions SET kind = 'MISSING_HERE' WHERE id = $1",
      'DELETE FROM reconciliation.exceptions WHERE id = $1',
    ]) {
      await expect(owner.query(statement, [id])).rejects.toThrow(/append-only/);
    }
  });

  it('keeps one resolution per exception', async () => {
    const id = await record(day(), 'MISSING_AT_SPI', 'E00000000202501011200oneresolvex');
    await resolve(id);

    await expect(resolve(id)).rejects.toThrow(/resolutions_pkey/);
  });

  it('resolves only an exception that exists', async () => {
    await expect(resolve(randomUUID())).rejects.toThrow(/resolutions_exception_id_fkey/);
  });

  it('gives an explanation its text and no request, a settlement its request and no text', async () => {
    const runDate = day();
    const ids = await Promise.all(
      ['a', 'b', 'c'].map((letter) =>
        record(runDate, 'STALE_PROCESSING', `E00000000202501011200${letter.repeat(11)}`),
      ),
    );
    const [explained, settled, wrong] = ids as [string, string, string];

    await expect(resolve(explained)).resolves.toBeDefined();
    await expect(
      resolve(settled, {
        outcome: 'SETTLED',
        approval_request_id: randomUUID(),
        explanation: null,
      }),
    ).resolves.toBeDefined();
    for (const overrides of [
      { explanation: null },
      { approval_request_id: randomUUID() },
      { outcome: 'REFUNDED', approval_request_id: randomUUID() },
      { outcome: 'REFUNDED', explanation: null },
    ]) {
      await expect(resolve(wrong, overrides)).rejects.toThrow(/resolutions_outcome_check/);
    }
  });

  it('refuses an unknown outcome, and an explanation shorter than 10 or over 500', async () => {
    const id = await record(day(), 'CLEARING_MISMATCH', null, { expected: 10, actual: 9 });

    await expect(resolve(id, { outcome: 'FORGOTTEN' })).rejects.toThrow(/check/);
    await expect(resolve(id, { explanation: 'ok' })).rejects.toThrow(
      /resolutions_explanation_check/,
    );
    await expect(resolve(id, { explanation: 'x'.repeat(501) })).rejects.toThrow(
      /resolutions_explanation_check/,
    );
  });

  it('never lets anyone change or delete a resolution', async () => {
    const id = await record(day(), 'MISSING_HERE', 'E00000000202501011200resolvedxxx');
    await resolve(id);

    for (const statement of [
      "UPDATE reconciliation.resolutions SET explanation = 'another one' WHERE exception_id = $1",
      'DELETE FROM reconciliation.resolutions WHERE exception_id = $1',
    ]) {
      await expect(app.query(statement, [id])).rejects.toThrow(/permission denied/);
      await expect(owner.query(statement, [id])).rejects.toThrow(/append-only/);
    }
  });
});
