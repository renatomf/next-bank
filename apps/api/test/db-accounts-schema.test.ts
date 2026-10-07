import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// Current accounts (database.md, section 5.2): one per customer, numbered by a
// sequence, never holding a balance (that is the ledger's job).
describe('accounts schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  let nextNumber = 0;
  function uniqueNumber(): string {
    nextNumber += 1;
    // Far from the sequence range, so these never clash with numbers it hands out.
    return `${String(900000 + nextNumber)}-0`;
  }

  async function insertAccount(overrides: Record<string, unknown> = {}): Promise<string> {
    const account = {
      id: randomUUID(),
      holder_user_id: randomUUID(),
      branch: '0001',
      number: uniqueNumber(),
      status: 'ACTIVE',
      ...overrides,
    };
    await app.query(
      `INSERT INTO accounts.accounts
         (id, holder_user_id, branch, number, status, opened_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [account.id, account.holder_user_id, account.branch, account.number, account.status],
    );
    return account.id;
  }

  it('lets the API open an account', async () => {
    const id = await insertAccount();

    const { rows } = await app.query('SELECT status FROM accounts.accounts WHERE id = $1', [id]);
    expect(rows).toEqual([{ status: 'ACTIVE' }]);
  });

  it('keeps one account per customer', async () => {
    const holder = randomUUID();
    await insertAccount({ holder_user_id: holder });

    await expect(insertAccount({ holder_user_id: holder })).rejects.toThrow(
      /accounts_holder_user_id_key/,
    );
  });

  it('never repeats an account number in the branch', async () => {
    const number = uniqueNumber();
    await insertAccount({ number });

    await expect(insertAccount({ number })).rejects.toThrow(/accounts_branch_number_key/);
  });

  it('accepts only branch 0001, the number format and known statuses', async () => {
    await expect(insertAccount({ branch: '0002' })).rejects.toThrow(/check constraint/);
    await expect(insertAccount({ number: '12345-6' })).rejects.toThrow(/check constraint/);
    await expect(insertAccount({ number: '123456-X' })).rejects.toThrow(/check constraint/);
    await expect(insertAccount({ status: 'FROZEN' })).rejects.toThrow(/check constraint/);
  });

  it('hands out sequential numbers from 100000 to the API role', async () => {
    const { rows } = await app.query<{ n: string }>(
      "SELECT nextval('accounts.account_number_seq') AS n",
    );

    expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(100000);
    expect(Number(rows[0]?.n)).toBeLessThanOrEqual(999999);
  });

  it('lets the API change only the status, never delete (least privilege)', async () => {
    const id = await insertAccount();

    await expect(
      app.query(
        `UPDATE accounts.accounts SET status = 'BLOCKED', updated_at = now() WHERE id = $1`,
        [id],
      ),
    ).resolves.toBeDefined();
    await expect(
      app.query('UPDATE accounts.accounts SET holder_user_id = $2 WHERE id = $1', [
        id,
        randomUUID(),
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(app.query('DELETE FROM accounts.accounts WHERE id = $1', [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.query('TRUNCATE accounts.accounts')).rejects.toThrow(/permission denied/);
  });
});
