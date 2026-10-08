import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl, testMigrationDatabaseUrl } from './helpers.ts';

// The ledger is the last barrier for the money (ADR 0005; database.md,
// sections 5.3, 6 and 10): every invariant below holds in the database even
// if a bug gets past the domain.
describe('ledger schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  /** Runs [work] in one transaction; deferred checks run at the COMMIT. */
  async function inTransaction(work: () => Promise<void>): Promise<void> {
    await app.query('BEGIN');
    try {
      await work();
      await app.query('COMMIT');
    } catch (error) {
      await app.query('ROLLBACK');
      throw error;
    }
  }

  async function customerAccount(balance = 0): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO ledger.ledger_accounts
         (id, code, kind, currency, posted_balance, available_balance, version, created_at)
       VALUES ($1, $2, 'CUSTOMER', 'BRL', $3, $3, 0, now())`,
      [id, `customer:${randomUUID()}`, balance],
    );
    return id;
  }

  async function fundingAccount(): Promise<string> {
    const { rows } = await app.query<{ id: string }>(
      `SELECT id FROM ledger.ledger_accounts WHERE code = 'system:funding'`,
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('system:funding is missing');
    return id;
  }

  async function insertEntry(referenceId = randomUUID(), kind = 'FUNDING'): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO ledger.journal_entries (id, kind, reference_type, reference_id, created_at)
       VALUES ($1, $2, 'ACCOUNT', $3, now())`,
      [id, kind, referenceId],
    );
    return id;
  }

  async function insertPosting(
    entryId: string,
    accountId: string,
    direction: string,
    amount: number,
  ): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO ledger.postings
         (id, journal_entry_id, ledger_account_id, direction, amount, currency,
          counterparty_name, counterparty_document_masked, created_at)
       VALUES ($1, $2, $3, $4, $5, 'BRL', 'next bank', NULL, now())`,
      [id, entryId, accountId, direction, amount],
    );
    return id;
  }

  /** A balanced R$ 100,00 funding: debit system:funding, credit the customer. */
  async function postFunding(customerId: string): Promise<string> {
    let entryId = '';
    await inTransaction(async () => {
      entryId = await insertEntry();
      await insertPosting(entryId, await fundingAccount(), 'D', 10_000);
      await insertPosting(entryId, customerId, 'C', 10_000);
    });
    return entryId;
  }

  describe('ledger accounts', () => {
    it('has system:funding, a system account without a materialized balance', async () => {
      const { rows } = await app.query(
        `SELECT kind, currency, posted_balance, available_balance
         FROM ledger.ledger_accounts WHERE code = 'system:funding'`,
      );

      expect(rows).toEqual([
        { kind: 'SYSTEM', currency: 'BRL', posted_balance: '0', available_balance: '0' },
      ]);
    });

    it('never lets a customer balance go negative (T-DB-01)', async () => {
      const id = await customerAccount(5_000);

      await expect(
        app.query(
          `UPDATE ledger.ledger_accounts
           SET posted_balance = -1, available_balance = -1 WHERE id = $1`,
          [id],
        ),
      ).rejects.toThrow(/ledger_accounts_available_check/);
    });

    it('never lets holds create money: available stays at most posted', async () => {
      const id = await customerAccount(5_000);

      await expect(
        app.query('UPDATE ledger.ledger_accounts SET available_balance = 6000 WHERE id = $1', [id]),
      ).rejects.toThrow(/ledger_accounts_reserve_check/);
    });

    it('keeps system accounts at zero: their balance is the sum of postings', async () => {
      const id = await fundingAccount();

      await expect(
        app.query('UPDATE ledger.ledger_accounts SET posted_balance = -100 WHERE id = $1', [id]),
      ).rejects.toThrow(/ledger_accounts_system_balance_check/);
    });

    it('matches the code to the kind and accepts only BRL', async () => {
      await expect(
        app.query(
          `INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
           VALUES ($1, 'system:other', 'CUSTOMER', 'BRL', now())`,
          [randomUUID()],
        ),
      ).rejects.toThrow(/ledger_accounts_code_kind_check/);
      await expect(
        app.query(
          `INSERT INTO ledger.ledger_accounts (id, code, kind, currency, created_at)
           VALUES ($1, $2, 'CUSTOMER', 'USD', now())`,
          [randomUUID(), `customer:${randomUUID()}`],
        ),
      ).rejects.toThrow(/check constraint/);
    });

    it('lets the API change only balances and version, never delete', async () => {
      const id = await customerAccount(5_000);

      await expect(
        app.query(
          `UPDATE ledger.ledger_accounts
           SET posted_balance = 4000, available_balance = 4000, version = version + 1
           WHERE id = $1`,
          [id],
        ),
      ).resolves.toBeDefined();
      await expect(
        app.query(`UPDATE ledger.ledger_accounts SET kind = 'SYSTEM' WHERE id = $1`, [id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        app.query('DELETE FROM ledger.ledger_accounts WHERE id = $1', [id]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe('journal entries and postings', () => {
    it('accepts a balanced entry', async () => {
      const customer = await customerAccount();

      const entryId = await postFunding(customer);

      const { rows } = await app.query(
        'SELECT count(*)::int AS n FROM ledger.postings WHERE journal_entry_id = $1',
        [entryId],
      );
      expect(rows).toEqual([{ n: 2 }]);
    });

    it('refuses at COMMIT an entry whose debits differ from its credits (T-DB-02)', async () => {
      const customer = await customerAccount();

      await expect(
        inTransaction(async () => {
          const entryId = await insertEntry();
          await insertPosting(entryId, await fundingAccount(), 'D', 10_000);
          await insertPosting(entryId, customer, 'C', 9_999);
        }),
      ).rejects.toThrow(/unbalanced/);
    });

    it('refuses at COMMIT an entry with a single posting', async () => {
      const customer = await customerAccount();

      await expect(
        inTransaction(async () => {
          const entryId = await insertEntry();
          await insertPosting(entryId, customer, 'C', 10_000);
        }),
      ).rejects.toThrow(/unbalanced/);
    });

    // Without a check on the entry itself, no posting trigger would ever fire.
    it('refuses at COMMIT an entry without postings (T-DB-02b)', async () => {
      await expect(
        inTransaction(async () => {
          await insertEntry();
        }),
      ).rejects.toThrow(/unbalanced/);
    });

    it('refuses a second entry of the same kind for the same reference (T-DB-05)', async () => {
      const customer = await customerAccount();
      const reference = randomUUID();
      await inTransaction(async () => {
        const entryId = await insertEntry(reference);
        await insertPosting(entryId, await fundingAccount(), 'D', 10_000);
        await insertPosting(entryId, customer, 'C', 10_000);
      });

      await expect(insertEntry(reference)).rejects.toThrow(
        /journal_entries_reference_type_reference_id_kind_key/,
      );
    });

    it('posts a Pix at most once, whatever the application does (T-DB-05)', async () => {
      const pixId = randomUUID();
      const insertPixEntry = () =>
        app.query(
          `INSERT INTO ledger.journal_entries (id, kind, reference_type, reference_id, created_at)
           VALUES ($1, 'PIX_INTERNAL', 'PIX_TRANSFER', $2, now())`,
          [randomUUID(), pixId],
        );
      const payer = await customerAccount(10_000);
      const payee = await customerAccount();
      await inTransaction(async () => {
        await insertPixEntry();
        const { rows } = await app.query<{ id: string }>(
          'SELECT id FROM ledger.journal_entries WHERE reference_id = $1',
          [pixId],
        );
        const entryId = rows[0]?.id ?? '';
        await insertPosting(entryId, payer, 'D', 8_000);
        await insertPosting(entryId, payee, 'C', 8_000);
      });

      await expect(insertPixEntry()).rejects.toThrow(
        /journal_entries_reference_type_reference_id_kind_key/,
      );
    });

    it('accepts only positive amounts, D or C, and known entry kinds', async () => {
      const customer = await customerAccount();

      await expect(
        inTransaction(async () => {
          await insertPosting(await insertEntry(), customer, 'C', 0);
        }),
      ).rejects.toThrow(/check constraint/);
      await expect(
        inTransaction(async () => {
          await insertPosting(await insertEntry(), customer, 'X', 100);
        }),
      ).rejects.toThrow(/check constraint/);
      await expect(insertEntry(randomUUID(), 'GIFT')).rejects.toThrow(/check constraint/);
    });

    it('denies UPDATE, DELETE and TRUNCATE to the API role (T-DB-03)', async () => {
      const entryId = await postFunding(await customerAccount());

      for (const table of ['ledger.postings', 'ledger.journal_entries']) {
        const column = table === 'ledger.postings' ? 'journal_entry_id' : 'id';
        await expect(
          app.query(`UPDATE ${table} SET created_at = now() WHERE ${column} = $1`, [entryId]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          app.query(`DELETE FROM ${table} WHERE ${column} = $1`, [entryId]),
        ).rejects.toThrow(/permission denied/);
        await expect(app.query(`TRUNCATE ${table}`)).rejects.toThrow(/permission denied/);
      }
    });

    it('refuses changes even from the table owner (defense in depth, T-DB-03)', async () => {
      const entryId = await postFunding(await customerAccount());
      const owner = new pg.Client({ connectionString: testMigrationDatabaseUrl() });
      await owner.connect();
      try {
        await expect(
          owner.query('UPDATE ledger.postings SET amount = 1 WHERE journal_entry_id = $1', [
            entryId,
          ]),
        ).rejects.toThrow(/append-only/);
        await expect(
          owner.query('DELETE FROM ledger.journal_entries WHERE id = $1', [entryId]),
        ).rejects.toThrow(/append-only/);
        await expect(owner.query('TRUNCATE ledger.postings')).rejects.toThrow(/append-only/);
      } finally {
        await owner.end();
      }
    });
  });
});
