import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { PgAuditReader } from '../../../src/modules/audit/index.ts';
import { createPool } from '../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../helpers.ts';

// Every read of the audit trail by the staff (v1.3.0 plan, task 8) is served
// by an index, however long the trail grows (CLAUDE.md, section 6).
const pool = createPool(testDatabaseUrl());

afterAll(async () => {
  await pool.end();
});

/** The plan of [sql], with sequential scans off: only whether an index can serve it. */
async function planOf(sql: string, params: unknown[]): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL enable_seqscan = off');
    const { rows } = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${sql}`, params);
    return rows.map((row) => row['QUERY PLAN']).join('\n');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

const AFTER = [new Date('2026-11-03T12:00:00.000Z'), randomUUID()];

describe('the audit trail queries of the staff', () => {
  it.each([
    [
      'by member',
      PgAuditReader.MEMBER_SQL,
      [randomUUID(), ...AFTER, 21],
      ['audit_events_actor_idx', 'audit_events_subject_idx'],
    ],
    [
      'by customer',
      PgAuditReader.CUSTOMER_SQL,
      [randomUUID(), randomUUID(), ...AFTER, 21],
      ['audit_events_actor_idx', 'audit_events_subject_idx'],
    ],
    [
      'by request',
      PgAuditReader.REQUEST_SQL,
      [randomUUID(), ...AFTER, 21],
      ['audit_events_subject_idx', 'audit_events_approval_request_idx'],
    ],
  ])('%s is served by its indexes', async (_name, sql, params, indexes) => {
    const plan = await planOf(sql, params);

    for (const index of indexes) expect(plan).toContain(index);
  });
});
