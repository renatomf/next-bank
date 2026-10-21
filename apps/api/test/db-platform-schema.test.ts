import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// What every module's financial commands share (ADR 0015): the idempotency
// records (ADR 0007; database.md, sections 5.4 and 6) live outside any one
// module, so the Pix and the top-ups use the same table without one module
// writing in another's schema. The database refuses what the code must never
// write.
describe('platform schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  describe('idempotency records', () => {
    async function insertRecord(
      userId: string,
      key: string,
      columns: Record<string, unknown> = {},
    ): Promise<void> {
      const row: Record<string, unknown> = {
        user_id: userId,
        key,
        operation: 'pix.create',
        request_hash: randomBytes(32),
        status: 'IN_PROGRESS',
        response_status: null,
        response_body: null,
        created_at: new Date('2026-10-07T12:00:00Z'),
        expires_at: new Date('2026-10-08T12:00:00Z'),
        ...columns,
      };
      const names = Object.keys(row);
      await app.query(
        `INSERT INTO platform.idempotency_records (${names.join(', ')})
         VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(', ')})`,
        Object.values(row),
      );
    }

    it('keeps one record per user and key (T-DB-06)', async () => {
      const userId = randomUUID();
      const key = randomUUID();
      await insertRecord(userId, key);

      await expect(insertRecord(userId, key)).rejects.toThrow(/idempotency_records_pkey/);
      await expect(insertRecord(randomUUID(), key)).resolves.toBeUndefined();
    });

    it('stores a response exactly when the request is completed', async () => {
      await expect(
        insertRecord(randomUUID(), randomUUID(), { status: 'COMPLETED' }),
      ).rejects.toThrow(/idempotency_records_response_check/);
      await expect(
        insertRecord(randomUUID(), randomUUID(), { response_status: 201, response_body: {} }),
      ).rejects.toThrow(/idempotency_records_response_check/);
      await expect(
        insertRecord(randomUUID(), randomUUID(), {
          status: 'COMPLETED',
          response_status: 201,
          response_body: { id: randomUUID() },
        }),
      ).resolves.toBeUndefined();
    });

    it('accepts only known operations, a SHA-256 hash and 24 hours of validity', async () => {
      await expect(
        insertRecord(randomUUID(), randomUUID(), { operation: 'pix.refund' }),
      ).rejects.toThrow(/check constraint/);
      await expect(
        insertRecord(randomUUID(), randomUUID(), { request_hash: randomBytes(16) }),
      ).rejects.toThrow(/check constraint/);
      await expect(
        insertRecord(randomUUID(), randomUUID(), { expires_at: new Date('2026-10-09T12:00:00Z') }),
      ).rejects.toThrow(/idempotency_records_expires_at_check/);
    });

    it('lets the API complete and clean up records', async () => {
      const userId = randomUUID();
      const key = randomUUID();
      await insertRecord(userId, key);

      await app.query(
        `UPDATE platform.idempotency_records
         SET status = 'COMPLETED', response_status = 201, response_body = '{}'
         WHERE user_id = $1 AND key = $2`,
        [userId, key],
      );
      const { rowCount } = await app.query(
        'DELETE FROM platform.idempotency_records WHERE user_id = $1 AND key = $2',
        [userId, key],
      );
      expect(rowCount).toBe(1);
    });
  });

  it('denies DDL and TRUNCATE in the schema to the API role (T-DB-13)', async () => {
    await expect(app.query('CREATE TABLE platform.intruder (id int)')).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.query('TRUNCATE platform.idempotency_records')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('leaves no idempotency table in the payments schema', async () => {
    const { rows } = await app.query<{ found: string | null }>(
      "SELECT to_regclass('payments.idempotency_records')::text AS found",
    );
    expect(rows[0]?.found).toBeNull();
  });
});
