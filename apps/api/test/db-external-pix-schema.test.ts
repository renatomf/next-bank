import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The Pix to another bank (v1.2.0 plan, task 3, P3): the payee is either an
// account of next bank or another bank's key, never both nor neither; the
// key goes encrypted, to be sent to the SPI; the end-to-end id exists from
// the authorization, because it goes with every attempt (EXT-03). In the
// ledger, the money leaves for system:pix_clearing (ADR 0005).
describe('external Pix schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  const external = {
    payee_account_id: null,
    payee_ispb: '99900001',
    payee_bank_name: 'Banco Aurora',
    payee_key_ciphertext: randomBytes(48),
    payee_key_version: 1,
  };

  const authorized = {
    status: 'PROCESSING',
    end_to_end_id: 'E00099999202610221500a1B2c3D4e5F',
    authorized_at: new Date('2026-10-22T15:01:00Z'),
  };

  async function insertTransfer(columns: Record<string, unknown> = {}): Promise<string> {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      end_to_end_id: null,
      payer_account_id: randomUUID(),
      payee_account_id: randomUUID(),
      payee_key_type: 'EMAIL',
      payee_key_masked: 'cl***@example.com',
      payee_name: 'Clara Aurora Teixeira',
      payee_document_masked: '***.407.256-**',
      amount: 5_000,
      currency: 'BRL',
      description: null,
      status: 'AWAITING_AUTH',
      failure_reason: null,
      version: 0,
      created_at: new Date('2026-10-22T15:00:00Z'),
      expires_at: new Date('2026-10-22T15:10:00Z'),
      authorized_at: null,
      completed_at: null,
      updated_at: new Date('2026-10-22T15:00:00Z'),
      ...columns,
    };
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO payments.pix_transfers (${names.join(', ')})
       VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(', ')})`,
      Object.values(row),
    );
    return String(row.id);
  }

  it('takes a Pix to another bank, its key encrypted', async () => {
    await expect(insertTransfer(external)).resolves.toBeTypeOf('string');
  });

  it('keeps the end-to-end id of an external Pix from its authorization', async () => {
    await expect(insertTransfer({ ...external, ...authorized })).resolves.toBeTypeOf('string');
    await expect(
      insertTransfer({ ...external, ...authorized, end_to_end_id: null }),
    ).rejects.toThrow(/end_to_end_id/);
  });

  // A Pix that fails at authorization (no balance, a blocked account) never
  // reached the SPI, so it has no end-to-end id; one the SPI rejects has (task 4).
  it('lets an external Pix fail with or without its end-to-end id', async () => {
    const failed = {
      ...external,
      ...authorized,
      status: 'FAILED',
      failure_reason: 'INSUFFICIENT_FUNDS',
    };

    await expect(insertTransfer({ ...failed, end_to_end_id: null })).resolves.toBeTypeOf('string');
    await expect(insertTransfer(failed)).resolves.toBeTypeOf('string');
  });

  it('never gives an external Pix awaiting the PIN or cancelled an end-to-end id', async () => {
    for (const status of ['AWAITING_AUTH', 'CANCELLED']) {
      await expect(
        insertTransfer({ ...external, status, end_to_end_id: authorized.end_to_end_id }),
      ).rejects.toThrow(/end_to_end_id/);
    }
  });

  it('still gives an internal Pix its end-to-end id only when completed', async () => {
    await expect(insertTransfer(authorized)).rejects.toThrow(/end_to_end_id/);
  });

  it.each([
    ['both a next bank account and another bank', { ...external, payee_account_id: randomUUID() }],
    ['neither', { ...external, payee_ispb: null, payee_bank_name: null }],
    ["another bank's Pix without its key", { ...external, payee_key_ciphertext: null }],
    ['a bank without its name', { ...external, payee_bank_name: null }],
    ['a malformed ISPB', { ...external, payee_ispb: '9990' }],
  ])('refuses a payee with %s', async (_case, columns) => {
    await expect(insertTransfer(columns)).rejects.toThrow();
  });

  it('never lets the API change who an external Pix goes to', async () => {
    const id = await insertTransfer(external);

    for (const change of ["payee_ispb = '99900002'", "payee_key_ciphertext = '\\x00'"]) {
      await expect(
        app.query(`UPDATE payments.pix_transfers SET ${change} WHERE id = $1`, [id]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('opens the clearing account and takes PIX_EXTERNAL entries in the ledger', async () => {
    const accounts = await app.query<{ kind: string }>(
      "SELECT kind FROM ledger.ledger_accounts WHERE code = 'system:pix_clearing'",
    );
    const check = await app.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname = 'journal_entries_kind_check'`,
    );

    expect(accounts.rows).toEqual([{ kind: 'SYSTEM' }]);
    expect(check.rows[0]?.definition).toContain("'PIX_EXTERNAL'");
  });
});
