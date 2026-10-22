import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { SEND_EXTERNAL_PIX } from '../../../../src/modules/payments/application/authorize-pix-transfer.ts';
import type { SpiPort } from '../../../../src/modules/payments/application/ports.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { createOutbox } from '../../../../src/shared/infrastructure/outbox-factory.ts';
import { UuidV7Generator } from '../../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { type Customer, pgPixStack } from './pg-pix-stack.ts';

// The Pix to another bank against the real database (v1.2.0 plan, task 3):
// the debit, the Pix waiting for the SPI and the message that sends it are
// one transaction (ADR 0010, ADR 0016), under the same locks as the internal
// Pix (database.md 7; PIX-03). The DICT is a stand-in: only the database is
// under test here. 15:00 UTC is 12:00 in São Paulo.
const NOW = new Date('2026-10-22T15:00:00.000Z');
const AURORA = { type: 'EMAIL' as const, value: 'clara.aurora@example.com' };
const pool = createPool(testDatabaseUrl());

const dict: SpiPort = {
  findKey: (key) =>
    Promise.resolve(
      key === AURORA.value
        ? {
            keyType: 'EMAIL',
            bank: { ispb: '99900001', name: 'Banco Aurora' },
            owner: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
          }
        : null,
    ),
  send: () => Promise.resolve(),
};

const { outbox } = createOutbox({
  pool,
  ids: new UuidV7Generator(),
  clock: () => NOW,
  errorReporter: { report: () => undefined },
  handlers: new Map([[SEND_EXTERNAL_PIX, () => Promise.resolve()]]),
});
const pix = pgPixStack(pool, new FixedClock(NOW), { spi: dict, outbox });
const brokenOutbox = pgPixStack(pool, new FixedClock(NOW), {
  spi: dict,
  outbox: { enqueue: () => Promise.reject(new Error('outbox unavailable')) },
});

afterAll(async () => {
  await pool.end();
});

async function messagesFor(pixId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM platform.outbox_messages
     WHERE type = $1 AND payload->>'transferId' = $2`,
    [SEND_EXTERNAL_PIX, pixId],
  );
  return rows[0]?.n ?? 0;
}

async function entriesFor(pixId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ledger.journal_entries
     WHERE reference_type = 'PIX_TRANSFER' AND reference_id = $1`,
    [pixId],
  );
  return rows[0]?.n ?? 0;
}

async function statusOf(pixId: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ status: string }>(
    'SELECT status FROM payments.pix_transfers WHERE id = $1',
    [pixId],
  );
  return rows[0]?.status;
}

/** The customer's balance as the ledger keeps it, and the sum of its postings. */
async function balancesOf(customer: Customer): Promise<{ materialized: string; posted: string }> {
  const { rows } = await pool.query<{ materialized: string; posted: string }>(
    `SELECT l.posted_balance AS materialized,
            coalesce(sum(CASE p.direction WHEN 'C' THEN p.amount ELSE -p.amount END), 0) AS posted
       FROM ledger.ledger_accounts l
       JOIN accounts.accounts a ON l.code = 'customer:' || a.id
       LEFT JOIN ledger.postings p ON p.ledger_account_id = l.id
      WHERE a.holder_user_id = $1
      GROUP BY l.id`,
    [customer.userId],
  );
  const row = rows[0];
  if (!row) throw new Error('customer without a ledger account');
  return { materialized: row.materialized, posted: row.posted };
}

describe('the Pix to another bank on Postgres', () => {
  it('spends the same balance once with three Pix authorized at once (PIX-03)', async () => {
    const payer = await pix.newCustomer();
    const ids = [
      await pix.createToKey(payer, AURORA, 400_000),
      await pix.createToKey(payer, AURORA, 400_000),
      await pix.createToKey(payer, AURORA, 400_000),
    ];

    const results = await Promise.all(ids.map((id) => pix.authorize(payer, id)));

    expect(results.map((r) => r.status).sort()).toEqual(['FAILED', 'PROCESSING', 'PROCESSING']);
    expect(results.find((r) => r.status === 'FAILED')?.failureReason).toBe('INSUFFICIENT_FUNDS');
    const messages = await Promise.all(ids.map((id) => messagesFor(id)));
    expect(messages.reduce((sum, n) => sum + n, 0)).toBe(2);
    expect(await balancesOf(payer)).toEqual({ materialized: '200000', posted: '200000' });
  });

  it('writes one message for the same authorization sent ten times at once (PIX-02)', async () => {
    const payer = await pix.newCustomer();
    const pixId = await pix.createToKey(payer, AURORA, 8_000);
    const key = randomUUID();

    await Promise.allSettled(Array.from({ length: 10 }, () => pix.authorize(payer, pixId, key)));

    expect(await messagesFor(pixId)).toBe(1);
    expect(await entriesFor(pixId)).toBe(1);
    expect(await statusOf(pixId)).toBe('PROCESSING');
  });

  // ADR 0016: without the message the debit would never reach the SPI.
  it('undoes the debit and keeps the Pix awaiting the PIN when the message fails', async () => {
    const payer = await brokenOutbox.newCustomer();
    const pixId = await brokenOutbox.createToKey(payer, AURORA, 8_000);

    await expect(brokenOutbox.authorize(payer, pixId)).rejects.toThrow(/outbox unavailable/);

    expect(await entriesFor(pixId)).toBe(0);
    expect(await statusOf(pixId)).toBe('AWAITING_AUTH');
    expect(await balancesOf(payer)).toEqual({ materialized: '1000000', posted: '1000000' });
  });
});
