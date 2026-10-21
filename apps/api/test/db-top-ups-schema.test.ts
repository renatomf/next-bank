import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// Top-ups (v1.1.0 plan, task 5; database.md, section 5): the database is the
// last barrier and refuses what the domain must never write, with the API
// role. A top-up is only ever inserted.
describe('top-ups schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insertTopUp(columns: Record<string, unknown> = {}): Promise<string> {
    const id = randomUUID();
    const row: Record<string, unknown> = {
      id,
      account_id: randomUUID(),
      operator_id: 'pulso-celular',
      phone_ciphertext: randomBytes(48),
      phone_key_version: 1,
      phone_masked: '(11) *****-0001',
      amount: 3000,
      currency: 'BRL',
      status: 'COMPLETED',
      provider_reference: 'fake-1',
      created_at: new Date('2026-10-21T18:00:00Z'),
      ...columns,
    };
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO top_ups.top_ups (${names.join(', ')})
       VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(', ')})`,
      Object.values(row),
    );
    return id;
  }

  it('keeps a top-up the API inserts', async () => {
    const id = await insertTopUp();

    const { rows } = await app.query('SELECT status FROM top_ups.top_ups WHERE id = $1', [id]);
    expect(rows).toEqual([{ status: 'COMPLETED' }]);
  });

  it.each([
    ['an operator it does not have (D6)', { operator_id: 'vivo' }],
    ['an amount not offered (D6)', { amount: 2500 }],
    ['the number in clear (TOP-01)', { phone_masked: '(11) 90000-0001' }],
    ['another currency', { currency: 'USD' }],
    ['a status of a later version', { status: 'PENDING' }],
    ['an empty provider reference', { provider_reference: '' }],
  ])('refuses %s', async (_case, columns) => {
    await expect(insertTopUp(columns)).rejects.toThrow(/check constraint/);
  });

  it('never lets the API change or remove a top-up', async () => {
    const id = await insertTopUp();

    await expect(
      app.query("UPDATE top_ups.top_ups SET status = 'COMPLETED' WHERE id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(app.query('DELETE FROM top_ups.top_ups WHERE id = $1', [id])).rejects.toThrow(
      /permission denied/,
    );
  });

  it('denies DDL and TRUNCATE in the schema to the API role (T-DB-13)', async () => {
    await expect(app.query('CREATE TABLE top_ups.intruder (id int)')).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.query('TRUNCATE top_ups.top_ups')).rejects.toThrow(/permission denied/);
  });

  it('opens one system account per operator in the ledger, where the money goes', async () => {
    const { rows } = await app.query<{ code: string }>(
      "SELECT code FROM ledger.ledger_accounts WHERE code LIKE 'system:top-up-%' ORDER BY code",
    );

    expect(rows.map((row) => row.code)).toEqual([
      'system:top-up-onda-movel',
      'system:top-up-pulso-celular',
      'system:top-up-rede-nova',
    ]);
  });

  it('takes top-up entries in the ledger and top-up keys in the idempotency records', async () => {
    const { rows } = await app.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname IN ('journal_entries_kind_check', 'idempotency_records_operation_check')
       ORDER BY conname`,
    );

    expect(rows.map((row) => row.definition)).toEqual([
      expect.stringContaining("'top-up.create'"),
      expect.stringContaining("'TOP_UP'"),
    ]);
  });
});
