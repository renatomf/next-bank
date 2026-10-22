import { afterAll, describe, expect, it } from 'vitest';
import { testMigrationDatabaseUrl, testPool } from './helpers.ts';

// The simulator's schema (v1.2.0 plan, task 1): its own role reaches only its
// own schema (S1, ADR 0009), the database checks what a payment can be, and
// the banks and keys on the other side are made up (DEMO-01).
const pool = testPool();
const migrator = testPool(testMigrationDatabaseUrl());

afterAll(async () => {
  await pool.end();
  await migrator.end();
});

const e2e = (n: number) => `E99900001202610221500${String(n).padStart(11, '0')}`;

async function insertPayment(fields: Record<string, unknown> = {}) {
  const row = {
    end_to_end_id: e2e(Math.floor(Math.random() * 1e9)),
    request_hash: 'hash',
    amount: 100,
    currency: 'BRL',
    payer_ispb: '00000000',
    payer_name: 'Ana Demo',
    payer_document_masked: '***.444.777-**',
    payee_key: 'clara.aurora@example.com',
    payee_ispb: '99900001',
    status: 'PENDING',
    ...fields,
  };
  const columns = Object.keys(row);
  await pool.query(
    `INSERT INTO simulator.payments (${columns.join(', ')})
     VALUES (${columns.map((_, i) => `$${String(i + 1)}`).join(', ')})`,
    Object.values(row),
  );
}

describe('the simulator schema', () => {
  it('seeds three made-up banks and their customers keys', async () => {
    const banks = await pool.query<{ name: string }>('SELECT name FROM simulator.banks');
    const keys = await pool.query<{ key_type: string }>('SELECT key_type FROM simulator.dict_keys');

    expect(banks.rows).toHaveLength(3);
    expect(new Set(keys.rows.map((k) => k.key_type))).toEqual(
      new Set(['CPF', 'EMAIL', 'PHONE', 'RANDOM']),
    );
  });

  it('takes a valid payment', async () => {
    await expect(insertPayment()).resolves.toBeUndefined();
  });

  it.each([
    ['a zero amount', { amount: 0 }],
    ['another currency', { currency: 'USD' }],
    ['an unknown status', { status: 'LOST' }],
    ['a malformed end-to-end id', { end_to_end_id: 'E123' }],
    ['a settled payment without its time', { status: 'SETTLED' }],
    ['a rejected payment without its reason', { status: 'REJECTED' }],
  ])('refuses %s', async (_case, fields) => {
    await expect(insertPayment(fields)).rejects.toThrow();
  });

  it('keeps one payment per end-to-end id', async () => {
    const id = e2e(42);
    await insertPayment({ end_to_end_id: id });

    await expect(insertPayment({ end_to_end_id: id })).rejects.toThrow(/duplicate key/);
  });
});

describe('the simulator role (S1)', () => {
  it('reaches no schema but its own', async () => {
    const { rows } = await migrator.query<{ name: string }>(
      `SELECT nspname AS name FROM pg_namespace
       WHERE nspowner = current_user::regrole
         AND has_schema_privilege('nextbank_simulator', nspname, 'USAGE')`,
    );

    expect(rows.map((r) => r.name)).toEqual(['simulator']);
  });

  it('cannot change the banks or the keys of the DICT', async () => {
    await expect(pool.query("UPDATE simulator.banks SET name = 'x'")).rejects.toThrow(
      /permission denied/,
    );
    await expect(pool.query('DELETE FROM simulator.dict_keys')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('cannot change what a payment asked for', async () => {
    await expect(pool.query('UPDATE simulator.payments SET amount = 1')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('is not reached by the API role', async () => {
    const { rows } = await migrator.query<{ allowed: boolean }>(
      "SELECT has_schema_privilege('nextbank_app', 'simulator', 'USAGE') AS allowed",
    );

    expect(rows[0]?.allowed).toBe(false);
  });
});
