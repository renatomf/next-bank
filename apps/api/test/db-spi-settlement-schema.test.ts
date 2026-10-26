import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The SPI's answer (v1.2.0 plan, task 4): every webhook event is recorded
// once in an inbox (EXT-02), never changed nor deleted by the API; the money
// of a settled external Pix goes to system:bacen_settlement, and a refused
// one comes back to the customer, each under its own entry kind; the SPI's
// refusal is PAYEE_BANK_REJECTED (W1).
describe('SPI settlement schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function receive(eventId: string, outcome = 'APPLIED'): Promise<void> {
    await app.query(
      `INSERT INTO platform.inbox_events (event_id, source, outcome, received_at)
       VALUES ($1, 'spi', $2, now())`,
      [eventId, outcome],
    );
  }

  it('records an event once (EXT-02)', async () => {
    const eventId = randomUUID();
    await receive(eventId);

    await expect(receive(eventId)).rejects.toThrow(/inbox_events_pkey/);
  });

  it.each([
    ['an unknown outcome', { source: 'spi', outcome: 'MAYBE' }],
    ['an unknown source', { source: 'bank', outcome: 'APPLIED' }],
  ])('refuses an event with %s', async (_case, change) => {
    await expect(
      app.query(
        `INSERT INTO platform.inbox_events (event_id, source, outcome, received_at)
         VALUES ($1, $2, $3, now())`,
        [randomUUID(), change.source, change.outcome],
      ),
    ).rejects.toThrow(/check/);
  });

  it('never lets the API change or delete what it received', async () => {
    const eventId = randomUUID();
    await receive(eventId);

    for (const statement of [
      "UPDATE platform.inbox_events SET outcome = 'IGNORED' WHERE event_id = $1",
      'DELETE FROM platform.inbox_events WHERE event_id = $1',
    ]) {
      await expect(app.query(statement, [eventId])).rejects.toThrow(/permission denied/);
    }
  });

  it('opens the settlement account and takes the settlement and refund entries', async () => {
    const accounts = await app.query<{ kind: string }>(
      "SELECT kind FROM ledger.ledger_accounts WHERE code = 'system:bacen_settlement'",
    );
    const check = await app.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname = 'journal_entries_kind_check'`,
    );

    expect(accounts.rows).toEqual([{ kind: 'SYSTEM' }]);
    expect(check.rows[0]?.definition).toContain("'PIX_EXTERNAL_SETTLEMENT'");
    expect(check.rows[0]?.definition).toContain("'PIX_EXTERNAL_REFUND'");
  });

  it('keeps the end-to-end id of an external Pix the SPI refused (W1)', async () => {
    await expect(
      app.query(
        `INSERT INTO payments.pix_transfers
           (id, end_to_end_id, payer_account_id, payee_account_id, payee_key_type,
            payee_key_masked, payee_name, payee_document_masked, amount, currency, status,
            failure_reason, version, created_at, expires_at, authorized_at, updated_at,
            payee_ispb, payee_bank_name, payee_key_ciphertext, payee_key_version)
         VALUES ($1, $2, $3, NULL, 'EMAIL', 'cl***@example.com', 'Clara Aurora Teixeira',
                 '***.407.256-**', 5000, 'BRL', 'FAILED', 'PAYEE_BANK_REJECTED', 2,
                 '2026-10-26T15:00:00Z', '2026-10-26T15:10:00Z', '2026-10-26T15:01:00Z',
                 '2026-10-26T15:03:00Z', '99900001', 'Banco Aurora', $4, 1)`,
        [randomUUID(), 'E00000000202610261501r3J8kQ2mZ7x', randomUUID(), randomBytes(48)],
      ),
    ).resolves.toBeDefined();
  });

  it('indexes the external Pix waiting for the SPI, for the status check (W2)', async () => {
    const { rows } = await app.query<{ definition: string }>(
      `SELECT indexdef AS definition FROM pg_indexes
       WHERE indexname = 'pix_transfers_external_processing_idx'`,
    );

    expect(rows[0]?.definition).toMatch(/\(authorized_at\)/);
    expect(rows[0]?.definition).toMatch(/WHERE .*PROCESSING.*payee_ispb IS NOT NULL/);
  });
});
