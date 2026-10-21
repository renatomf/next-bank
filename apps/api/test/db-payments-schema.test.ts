import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// Pix keys and transfers (database.md, sections 5.4, 6 and 10; the idempotency
// records moved to the platform schema, ADR 0015): the database refuses what the domain must never write.
describe('payments schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insertKey(
    overrides: { type?: string; hmac?: Buffer; masked?: string } = {},
  ): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO payments.pix_keys
         (id, account_id, type, value_ciphertext, value_hmac, value_masked, key_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, now())`,
      [
        id,
        randomUUID(),
        overrides.type ?? 'CPF',
        randomBytes(48),
        overrides.hmac ?? randomBytes(32),
        overrides.masked ?? '•••.842.917-••',
      ],
    );
    return id;
  }

  /** A transfer awaiting authorization; [columns] override any column. */
  async function insertTransfer(columns: Record<string, unknown> = {}): Promise<string> {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      end_to_end_id: null,
      payer_account_id: randomUUID(),
      payee_account_id: randomUUID(),
      payee_key_type: 'CPF',
      payee_key_masked: '•••.842.917-••',
      payee_name: 'Marina Costa',
      payee_document_masked: '•••.842.917-••',
      amount: 8_000,
      currency: 'BRL',
      description: null,
      status: 'AWAITING_AUTH',
      failure_reason: null,
      version: 0,
      created_at: new Date('2026-10-07T12:00:00Z'),
      expires_at: new Date('2026-10-07T12:10:00Z'),
      authorized_at: null,
      completed_at: null,
      updated_at: new Date('2026-10-07T12:00:00Z'),
      ...columns,
    };
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO payments.pix_transfers (${names.join(', ')})
       VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(', ')})`,
      Object.values(row),
    );
    return row.id as string;
  }

  const completed = {
    status: 'COMPLETED',
    end_to_end_id: 'E00000000202610071201a1B2c3D4e5F',
    authorized_at: new Date('2026-10-07T12:01:00Z'),
    completed_at: new Date('2026-10-07T12:01:00Z'),
  };

  describe('pix keys', () => {
    it('lets the API register a key', async () => {
      const id = await insertKey();

      const { rows } = await app.query('SELECT type FROM payments.pix_keys WHERE id = $1', [id]);
      expect(rows).toEqual([{ type: 'CPF' }]);
    });

    it('never gives the same key to two accounts (T-DB-07)', async () => {
      const hmac = randomBytes(32);
      await insertKey({ hmac });

      await expect(insertKey({ hmac })).rejects.toThrow(/pix_keys_type_value_hmac_key/);
    });

    it('accepts only known types and a 32-byte blind index', async () => {
      await expect(insertKey({ type: 'NICKNAME' })).rejects.toThrow(/check constraint/);
      await expect(insertKey({ hmac: randomBytes(16) })).rejects.toThrow(/check constraint/);
    });

    it('lets the API only read and register keys (least privilege)', async () => {
      const id = await insertKey();

      await expect(
        app.query(`UPDATE payments.pix_keys SET type = 'EMAIL' WHERE id = $1`, [id]),
      ).rejects.toThrow(/permission denied/);
      await expect(app.query('DELETE FROM payments.pix_keys WHERE id = $1', [id])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe('pix transfers', () => {
    it('lets the API create a transfer awaiting authorization and complete it', async () => {
      const id = await insertTransfer();

      await expect(
        app.query(
          `UPDATE payments.pix_transfers
           SET status = 'COMPLETED', end_to_end_id = $2, authorized_at = $3,
               completed_at = $4, version = version + 1, updated_at = $4
           WHERE id = $1`,
          [id, completed.end_to_end_id, completed.authorized_at, completed.completed_at],
        ),
      ).resolves.toBeDefined();
    });

    it('accepts only a positive amount in BRL', async () => {
      await expect(insertTransfer({ amount: 0 })).rejects.toThrow(/check constraint/);
      await expect(insertTransfer({ amount: -100 })).rejects.toThrow(/check constraint/);
      await expect(insertTransfer({ currency: 'USD' })).rejects.toThrow(/check constraint/);
    });

    it('never sends a Pix to the payer itself', async () => {
      const account = randomUUID();

      await expect(
        insertTransfer({ payer_account_id: account, payee_account_id: account }),
      ).rejects.toThrow(/pix_transfers_payer_payee_check/);
    });

    it('limits the description to 140 characters and knows every status', async () => {
      await expect(insertTransfer({ description: 'x'.repeat(141) })).rejects.toThrow(
        /check constraint/,
      );
      await expect(insertTransfer({ status: 'CREATED' })).rejects.toThrow(/check constraint/);
    });

    it('refuses a completed Pix without its completion time (T-DB-10)', async () => {
      await expect(insertTransfer({ ...completed, completed_at: null })).rejects.toThrow(
        /pix_transfers_completed_check/,
      );
      await expect(
        insertTransfer({ completed_at: new Date('2026-10-07T12:01:00Z') }),
      ).rejects.toThrow(/pix_transfers_completed_check/);
    });

    it('gives an end-to-end id to completed Pix only, in the Bacen format', async () => {
      await expect(insertTransfer({ ...completed, end_to_end_id: null })).rejects.toThrow(
        /pix_transfers_end_to_end_id_check/,
      );
      await expect(insertTransfer({ end_to_end_id: completed.end_to_end_id })).rejects.toThrow(
        /pix_transfers_end_to_end_id_check/,
      );
      await expect(insertTransfer({ ...completed, end_to_end_id: 'E123' })).rejects.toThrow(
        /check constraint/,
      );
    });

    it('never repeats an end-to-end id', async () => {
      const endToEndId = 'E00000000202610071201Zz9Yy8Xx7Ww';
      await insertTransfer({ ...completed, end_to_end_id: endToEndId });

      await expect(insertTransfer({ ...completed, end_to_end_id: endToEndId })).rejects.toThrow(
        /pix_transfers_end_to_end_id_key/,
      );
    });

    it('records why a Pix failed, and only for a failed one', async () => {
      const authorized = { authorized_at: new Date('2026-10-07T12:01:00Z') };

      await expect(insertTransfer({ ...authorized, status: 'FAILED' })).rejects.toThrow(
        /pix_transfers_failure_reason_check/,
      );
      await expect(insertTransfer({ failure_reason: 'INSUFFICIENT_FUNDS' })).rejects.toThrow(
        /pix_transfers_failure_reason_check/,
      );
      await expect(
        insertTransfer({ ...authorized, status: 'FAILED', failure_reason: 'BAD_LUCK' }),
      ).rejects.toThrow(/pix_transfers_failure_reason_check/);
      await expect(
        insertTransfer({ ...authorized, status: 'FAILED', failure_reason: 'INSUFFICIENT_FUNDS' }),
      ).resolves.toBeDefined();
    });

    it('has an authorization time exactly when the Pix went past authorization', async () => {
      await expect(
        insertTransfer({ authorized_at: new Date('2026-10-07T12:01:00Z') }),
      ).rejects.toThrow(/pix_transfers_authorized_check/);
      await expect(insertTransfer({ status: 'PROCESSING' })).rejects.toThrow(
        /pix_transfers_authorized_check/,
      );
    });

    it('expires after it was created', async () => {
      await expect(
        insertTransfer({ expires_at: new Date('2026-10-07T12:00:00Z') }),
      ).rejects.toThrow(/pix_transfers_expires_at_check/);
    });

    it('lets the API change only the state of a Pix, never what was asked or delete', async () => {
      const id = await insertTransfer();

      for (const change of [
        'amount = 1',
        'payee_account_id = gen_random_uuid()',
        "payee_name = 'X'",
      ]) {
        await expect(
          app.query(`UPDATE payments.pix_transfers SET ${change} WHERE id = $1`, [id]),
        ).rejects.toThrow(/permission denied/);
      }
      await expect(
        app.query('DELETE FROM payments.pix_transfers WHERE id = $1', [id]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it('denies DDL and TRUNCATE in the schema to the API role (T-DB-13)', async () => {
    await expect(app.query('CREATE TABLE payments.intruder (id int)')).rejects.toThrow(
      /permission denied/,
    );
    for (const table of ['pix_keys', 'pix_transfers']) {
      await expect(app.query(`TRUNCATE payments.${table}`)).rejects.toThrow(/permission denied/);
    }
  });
});
