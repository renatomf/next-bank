import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { mountSimulator, type MountedSimulator } from '../../src/mount-simulator.ts';
import type { Clock } from '../../src/shared/application/ports.ts';
import { createPool } from '../../src/shared/db.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../modules/identity/fixtures.ts';
import { signedWebhook } from '../modules/payments/http/external-pix-client.ts';
import { participantKey } from '../simulator.ts';
import { type SpiLink, spiLink } from './spi-outage.ts';

// The chaos test of the Pix to other banks (v1.2.0 plan, task 9): the API and
// the simulator mounted in one service, on the real Postgres, the way
// production runs them. A thousand Pix under 30% of injected faults, an hour
// with the SPI gone, and a day of injected divergences. Money never
// disappears nor doubles, every Pix ends in a final state, and the
// reconciliation finds every divergence and nothing else. Run alone, on a
// database no other test touched (vitest.chaos.config.ts).

/** C3: drawn at each run, and told on failure; CHAOS_SEED repeats a run. */
const SEED = Number(process.env.CHAOS_SEED ?? randomInt(2 ** 32));
/** C2: 30% of the calls to the SPI and 30% of its webhooks go wrong; 10% are refused. */
const FAULTS = JSON.stringify({
  errorRate: 0.15,
  timeoutRate: 0.15,
  webhookLossRate: 0.15,
  webhookDuplicateRate: 0.15,
  rejectRate: 0.1,
});
const PIN = '2580';
const INITIAL_BALANCE = 1_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The made-up keys of the three made-up banks (seed of the simulator schema). */
const PAYEE_KEYS = [
  { type: 'EMAIL', value: 'clara.aurora@example.com' },
  { type: 'CPF', value: '31840725680' },
  { type: 'PHONE', value: '+5511900009001' },
  { type: 'RANDOM', value: '3f6c2a7e-9b41-4d5a-8e2f-1c7b9d0a4e63' },
  { type: 'CPF', value: '20578146371' },
] as const;

/**
 * The API's clock (C4): real time plus a lead the test moves forward, never
 * back, so the status check finds the Pix it waits for and the
 * reconciliation finds the day before.
 */
class MovableClock implements Clock {
  #leadMs = 0;

  now(): Date {
    return new Date(Date.now() + this.#leadMs);
  }

  advance(ms: number): void {
    this.#leadMs += ms;
  }

  /** At [at] at the earliest. */
  moveTo(at: Date): void {
    this.#leadMs = Math.max(this.#leadMs, at.getTime() - Date.now());
  }
}

/** The day of São Paulo (UTC−3, no daylight saving) of [at]. */
const saoPauloDay = (at: Date) => new Date(at.getTime() - 3 * HOUR).toISOString().slice(0, 10);
/** [time] of São Paulo on [day]. */
const saoPaulo = (day: string, time: string) => new Date(`${day}T${time}-03:00`);
const dayAfter = (day: string, days = 1) =>
  saoPauloDay(new Date(saoPaulo(day, '12:00:00').getTime() + days * DAY));

const clock = new MovableClock();
const webhookSecret = randomBytes(32);
const migrator = createPool(testMigrationDatabaseUrl());
let server: FastifyInstance;
let simulator: MountedSimulator;
let link: SpiLink;
let nextIp = 1;

/** A port free now, for a server that must know its own address before it listens. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('no port'));
        else resolve(address.port);
      });
    });
  });
}

beforeAll(async () => {
  const databaseUrl = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  const port = await freePort();
  const base = `http://127.0.0.1:${String(port)}`;
  link = await spiLink(base);
  server = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: `${link.url}/simulator`, participantKey, webhookSecret },
    clock,
  });
  simulator = await mountSimulator(server, {
    databaseUrl,
    participantKey,
    webhookSecret,
    webhookUrl: `${base}/v1/spi/webhooks`,
    faults: FAULTS,
    faultSeed: SEED,
    // The same time on both sides, as in production: webhooks are signed with it (EXT-01).
    clock: () => clock.now(),
  });
  await server.listen({ host: '127.0.0.1', port });
}, 60_000);

afterAll(async () => {
  await server.close();
  await link.close();
  await migrator.end();
});

/** What a failure says first: how to run the same faults again. */
const withSeed = (what: string) => `${what} (CHAOS_SEED=${String(SEED)})`;

interface Customer {
  token: string;
  ip: string;
}

/** A customer with R$ 10.000,00 and the PIN, each from an IP of its own (API-02). */
async function newCustomer(): Promise<Customer> {
  const ip = `198.18.${String(Math.floor(nextIp / 250) + 30)}.${String((nextIp % 250) + 1)}`;
  nextIp += 1;
  const registered = await server.inject({
    method: 'POST',
    url: '/v1/auth/register',
    remoteAddress: ip,
    payload: {
      name: 'Maria Teste',
      email: uniqueEmail(),
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
  });
  expect(registered.statusCode).toBe(201);
  const { accessToken } = registered.json<{ accessToken: string }>();
  const pin = await server.inject({
    method: 'POST',
    url: '/v1/me/pin',
    remoteAddress: ip,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { pin: PIN },
  });
  expect(pin.statusCode).toBe(204);
  return { token: accessToken, ip };
}

/** Creates and authorizes a Pix to [key]; it then waits for the SPI. */
async function send(
  from: Customer,
  key: (typeof PAYEE_KEYS)[number],
  cents: number,
): Promise<{ id: string; endToEndId: string }> {
  const headers = { authorization: `Bearer ${from.token}` };
  const created = await server.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    remoteAddress: from.ip,
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { key, amount: { amount: cents, currency: 'BRL' } },
  });
  expect(created.statusCode, created.body).toBe(201);
  const { id } = created.json<{ id: string }>();
  const authorized = await server.inject({
    method: 'POST',
    url: `/v1/pix/transfers/${id}/authorize`,
    remoteAddress: from.ip,
    headers: { ...headers, 'idempotency-key': randomUUID() },
    payload: { pin: PIN },
  });
  expect(authorized.statusCode, authorized.body).toBe(200);
  return { id, endToEndId: authorized.json<{ endToEndId: string }>().endToEndId };
}

/** [customers] customers sending [each] Pix, at most 20 at the same time. */
async function sendMany(customers: number, each: number): Promise<string[]> {
  const ids: string[] = [];
  let next = 0;
  async function lane(): Promise<void> {
    while (next < customers) {
      next += 1;
      const customer = await newCustomer();
      for (let i = 0; i < each; i += 1) {
        const key = PAYEE_KEYS[randomInt(PAYEE_KEYS.length)] ?? PAYEE_KEYS[0];
        ids.push((await send(customer, key, randomInt(100, 5_001))).id);
      }
    }
  }
  await Promise.all(Array.from({ length: 20 }, lane));
  return ids;
}

/** Runs [work] until it has nothing left to do. */
async function drain(work: () => Promise<number>): Promise<void> {
  while ((await work()) > 0);
}

/**
 * One round of what the server runs in a loop: deliver the outbox, send the
 * SPI's webhooks, let three minutes pass and check the Pix still waiting.
 * A call the SPI drops fails the round's step, as in the server, and the
 * next round tries again.
 */
async function round(): Promise<void> {
  await drain(() => server.outboxWorker.runOnce(100)).catch(() => undefined);
  await drain(() => simulator.dispatchDue()).catch(() => undefined);
  clock.advance(3 * MINUTE);
  await server.spiStatusCheck?.().catch(() => undefined);
}

/** What still moves: Pix waiting, messages to deliver, webhooks to send. */
async function stillMoving(): Promise<number> {
  const { rows } = await migrator.query<{ moving: string }>(
    `SELECT (SELECT count(*) FROM payments.pix_transfers
             WHERE payee_ispb IS NOT NULL AND status = 'PROCESSING')
          + (SELECT count(*) FROM platform.outbox_messages WHERE status = 'PENDING')
          + (SELECT count(*) FROM simulator.webhook_deliveries WHERE status = 'PENDING')
           AS moving`,
  );
  return Number(rows[0]?.moving);
}

/** Rounds until nothing moves, as the server would run them. */
async function settle(): Promise<void> {
  for (let rounds = 0; rounds < 200; rounds += 1) {
    if ((await stillMoving()) === 0) return;
    await round();
  }
  throw new Error(withSeed(`still moving after 200 rounds: ${String(await stillMoving())}`));
}

interface PixRow {
  id: string;
  end_to_end_id: string;
  status: string;
  failure_reason: string | null;
}

async function pixOf(ids: readonly string[]): Promise<PixRow[]> {
  const { rows } = await migrator.query<PixRow>(
    `SELECT id, end_to_end_id, status, failure_reason FROM payments.pix_transfers
     WHERE id = ANY($1)`,
    [ids],
  );
  return rows;
}

/** The ledger entries of each kind for [ids]. */
async function entriesOf(ids: readonly string[]): Promise<Map<string, string[]>> {
  const { rows } = await migrator.query<{ reference_id: string; kind: string }>(
    `SELECT reference_id, kind FROM ledger.journal_entries
     WHERE reference_type = 'PIX_TRANSFER' AND reference_id = ANY($1)`,
    [ids],
  );
  const kinds = new Map<string, string[]>();
  for (const row of rows)
    kinds.set(row.reference_id, [...(kinds.get(row.reference_id) ?? []), row.kind]);
  return kinds;
}

/**
 * Every invariant of money over the whole database (ADR 0005,
 * `domain-model.md` §6): each Pix final and matched one to one at the SPI,
 * each in the ledger once, refunded only when refused, every balance whole.
 */
async function expectMoneyWhole(): Promise<void> {
  const { rows: external } = await migrator.query<PixRow & { amount: string }>(
    `SELECT id, end_to_end_id, status, failure_reason, amount::text AS amount
     FROM payments.pix_transfers WHERE payee_ispb IS NOT NULL`,
  );
  const { rows: atSpi } = await migrator.query<{
    end_to_end_id: string;
    status: string;
    amount: string;
  }>('SELECT end_to_end_id, status, amount::text AS amount FROM simulator.payments');
  const spi = new Map(atSpi.map((payment) => [payment.end_to_end_id, payment]));
  const entries = await entriesOf(external.map((pix) => pix.id));

  // Final, and the SPI agrees: one payment per Pix, none without its Pix.
  expect(atSpi.length, withSeed('payments at the SPI')).toBe(external.length);
  for (const pix of external) {
    const payment = spi.get(pix.end_to_end_id);
    const kinds = (entries.get(pix.id) ?? []).sort();
    expect(payment?.amount, withSeed(`amount at the SPI of ${pix.id}`)).toBe(pix.amount);
    if (pix.status === 'COMPLETED') {
      expect(payment?.status, withSeed(`SPI of ${pix.id}`)).toBe('SETTLED');
      expect(kinds, withSeed(`ledger of ${pix.id}`)).toEqual([
        'PIX_EXTERNAL',
        'PIX_EXTERNAL_SETTLEMENT',
      ]);
    } else {
      expect(pix, withSeed(`final state of ${pix.id}`)).toMatchObject({
        status: 'FAILED',
        failure_reason: 'PAYEE_BANK_REJECTED',
      });
      expect(payment?.status, withSeed(`SPI of ${pix.id}`)).toBe('REJECTED');
      expect(kinds, withSeed(`ledger of ${pix.id}`)).toEqual([
        'PIX_EXTERNAL',
        'PIX_EXTERNAL_REFUND',
      ]);
    }
  }

  // Every entry balances, the clearing is empty and the settlement holds what was sent.
  const { rows: totals } = await migrator.query<{
    unbalanced: string;
    clearing: string;
    settlement: string;
    completed: string;
  }>(
    `SELECT
       (SELECT count(*) FROM (
          SELECT journal_entry_id FROM ledger.postings GROUP BY journal_entry_id
          HAVING sum(CASE direction WHEN 'D' THEN amount ELSE -amount END) <> 0) unbalanced
       ) AS unbalanced,
       (SELECT coalesce(sum(CASE p.direction WHEN 'C' THEN p.amount ELSE -p.amount END), 0)
          FROM ledger.postings p JOIN ledger.ledger_accounts a ON a.id = p.ledger_account_id
          WHERE a.code = 'system:pix_clearing') AS clearing,
       (SELECT abs(coalesce(sum(CASE p.direction WHEN 'C' THEN p.amount ELSE -p.amount END), 0))
          FROM ledger.postings p JOIN ledger.ledger_accounts a ON a.id = p.ledger_account_id
          WHERE a.code = 'system:bacen_settlement') AS settlement,
       (SELECT coalesce(sum(amount), 0) FROM payments.pix_transfers
          WHERE payee_ispb IS NOT NULL AND status = 'COMPLETED') AS completed`,
  );
  expect(totals[0], withSeed('ledger totals')).toMatchObject({
    unbalanced: '0',
    clearing: '0',
    settlement: totals[0]?.completed,
  });

  // Each payer keeps what it did not send.
  const { rows: wrong } = await migrator.query<{ code: string }>(
    `SELECT a.code FROM ledger.ledger_accounts a
     JOIN (SELECT payer_account_id,
                  sum(CASE status WHEN 'COMPLETED' THEN amount ELSE 0 END) AS sent
           FROM payments.pix_transfers WHERE payee_ispb IS NOT NULL
           GROUP BY payer_account_id) p ON a.code = 'customer:' || p.payer_account_id
     WHERE a.posted_balance <> $1 - p.sent OR a.available_balance <> a.posted_balance`,
    [INITIAL_BALANCE],
  );
  expect(wrong, withSeed('balances')).toEqual([]);
}

async function exceptionsOn(day: string) {
  const { rows } = await migrator.query<{ kind: string; end_to_end_id: string | null }>(
    'SELECT kind, end_to_end_id FROM reconciliation.exceptions WHERE run_date = $1',
    [day],
  );
  return rows;
}

/** Reconciles [day] as the server would, the morning after (R3). */
async function reconcile(day: string): Promise<void> {
  clock.moveTo(saoPaulo(dayAfter(day), '06:30:00'));
  expect(saoPauloDay(clock.now())).toBe(dayAfter(day));
  await expect(server.reconcileDueDay?.()).resolves.toMatchObject({ status: 'RECONCILED' });
}

/** Sends the outbox until the SPI holds a payment for each of [ids], faults and all. */
async function deliverToSpi(ids: readonly string[]): Promise<void> {
  for (let tries = 0; tries < 60; tries += 1) {
    await drain(() => server.outboxWorker.runOnce(100)).catch(() => undefined);
    const { rows } = await migrator.query<{ taken: string }>(
      `SELECT count(*) AS taken FROM payments.pix_transfers t
       JOIN simulator.payments p ON p.end_to_end_id = t.end_to_end_id
       WHERE t.id = ANY($1)`,
      [ids],
    );
    if (Number(rows[0]?.taken) === ids.length) return;
    clock.advance(MINUTE);
  }
  throw new Error(withSeed('the SPI never took every payment'));
}

/** The SPI settles [endToEndId] at [at], as its dispatcher would. */
async function settleAtSpi(endToEndId: string, at: Date): Promise<void> {
  await migrator.query(
    `UPDATE simulator.payments SET status = 'SETTLED', decided_at = $2, settled_at = $2
     WHERE end_to_end_id = $1`,
    [endToEndId, at],
  );
}

/** next bank takes the SPI's settlement of [endToEndId], by its signed webhook. */
async function completeHere(endToEndId: string): Promise<void> {
  const { body, headers } = signedWebhook(
    webhookSecret,
    {
      eventId: randomUUID(),
      version: 1,
      endToEndId,
      status: 'SETTLED',
      occurredAt: clock.now().toISOString(),
    },
    Math.floor(clock.now().getTime() / 1000),
  );
  const response = await server.inject({
    method: 'POST',
    url: '/v1/spi/webhooks',
    headers,
    payload: body,
  });
  expect(response.statusCode).toBeLessThan(300);
}

describe('the Pix to other banks under chaos', () => {
  const sent: string[] = [];

  // EXT-08: an hour without the SPI; nothing doubles nor goes back unconfirmed.
  it('waits out an hour without the SPI, and ends every Pix when it is back', async () => {
    // Authorized while the DICT answers, so the money left; then the SPI goes.
    const ids = await sendMany(5, 10);
    sent.push(...ids);
    link.down();
    for (let rounds = 0; rounds < 20; rounds += 1) await round();

    expect(new Set((await pixOf(ids)).map((pix) => pix.status))).toEqual(new Set(['PROCESSING']));
    expect([...(await entriesOf(ids)).values()].flat()).not.toContain('PIX_EXTERNAL_REFUND');
    const { rows: messages } = await migrator.query<{ status: string }>(
      `SELECT DISTINCT status FROM platform.outbox_messages WHERE payload->>'transferId' = ANY($1)`,
      [ids],
    );
    expect(messages).toEqual([{ status: 'DEAD' }]);

    link.up();
    await settle();

    expect((await pixOf(ids)).every((pix) => ['COMPLETED', 'FAILED'].includes(pix.status))).toBe(
      true,
    );
    await expectMoneyWhole();
  }, 300_000);

  // "Pronto quando": a thousand Pix under 30% of faults, each final and once.
  it('ends a thousand Pix under 30% of faults, each once, with the money whole', async () => {
    const ids = await sendMany(100, 10);
    sent.push(...ids);

    await settle();

    expect(ids).toHaveLength(1_000);
    await expectMoneyWhole();
  }, 600_000);

  // EXT-04: a day that agrees has no exception at all.
  it('reconciles the days of those Pix with no exception', async () => {
    const { rows } = await migrator.query<{ day: string }>(
      `SELECT DISTINCT to_char(completed_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day
       FROM payments.pix_transfers WHERE id = ANY($1) AND status = 'COMPLETED' ORDER BY day`,
      [sent],
    );
    for (const { day } of rows) {
      await reconcile(day);
      expect(await exceptionsOn(day), withSeed(`exceptions on ${day}`)).toEqual([]);
    }
  }, 120_000);
  // EXT-04, C6: each kind of divergence injected on a day of its own is found,
  // and nothing else. The day of the thousand Pix is reconciled once (R5).
  it('finds every divergence injected on a day, and nothing more', async () => {
    const day = dayAfter(saoPauloDay(clock.now()), 7);
    // Waiting since two days before, never answered.
    clock.moveTo(saoPaulo(dayAfter(day, -2), '12:00:00'));
    const stale = await sendMany(1, 5);
    clock.moveTo(saoPaulo(day, '10:00:00'));
    const ids = await sendMany(3, 7);
    await deliverToSpi([...stale, ...ids]);
    const endToEnd = new Map((await pixOf(ids)).map((pix) => [pix.id, pix.end_to_end_id]));
    const endToEndIds = (from: number, size = 5) =>
      ids.slice(from, from + size).map((id) => endToEnd.get(id) ?? '');
    const agree = endToEndIds(0);
    const amount = endToEndIds(5);
    const status = endToEndIds(10);
    const missingAtSpi = endToEndIds(15);
    const clearing = endToEndIds(20, 1)[0] ?? '';
    const settledAt = saoPaulo(day, '11:00:00');

    for (const id of agree) {
      await settleAtSpi(id, settledAt);
      await completeHere(id);
    }
    // The SPI settled another amount.
    for (const id of amount) {
      await settleAtSpi(id, settledAt);
      await migrator.query(
        'UPDATE simulator.payments SET amount = amount + 1 WHERE end_to_end_id = $1',
        [id],
      );
      await completeHere(id);
    }
    // Settled at the SPI; next bank never heard of it.
    for (const id of status) await settleAtSpi(id, settledAt);
    // Completed here; the SPI never settled it.
    for (const id of missingAtSpi) await completeHere(id);
    // Settled at the SPI, though next bank never sent it.
    const missingHere = Array.from(
      { length: 5 },
      () =>
        `E99999999${day.replaceAll('-', '')}1100${randomUUID().replaceAll('-', '').slice(0, 11)}`,
    );
    for (const id of missingHere) {
      await migrator.query(
        `INSERT INTO simulator.payments
           (end_to_end_id, request_hash, amount, currency, payer_ispb, payer_name,
            payer_document_masked, payee_key, payee_ispb, status, decided_at, settled_at)
         VALUES ($1, 'injected', 1000, 'BRL', '99999999', 'Ana Demo', '***.444.777-**',
                 'clara.aurora@example.com', '99900001', 'SETTLED', $2, $2)`,
        [id, settledAt],
      );
    }
    // Completed outside the flow: the money never left pix_clearing.
    await settleAtSpi(clearing, settledAt);
    await migrator.query(
      `UPDATE payments.pix_transfers SET status = 'COMPLETED', completed_at = $2, updated_at = $2
       WHERE end_to_end_id = $1`,
      [clearing, saoPaulo(day, '11:05:00')],
    );

    await reconcile(day);

    const expected = [
      ...missingHere.map((id) => ({ kind: 'MISSING_HERE', end_to_end_id: id })),
      ...amount.map((id) => ({ kind: 'AMOUNT_MISMATCH', end_to_end_id: id })),
      ...status.map((id) => ({ kind: 'STATUS_MISMATCH', end_to_end_id: id })),
      ...missingAtSpi.map((id) => ({ kind: 'MISSING_AT_SPI', end_to_end_id: id })),
      ...(await pixOf(stale)).map((pix) => ({
        kind: 'STALE_PROCESSING',
        end_to_end_id: pix.end_to_end_id,
      })),
      { kind: 'CLEARING_MISMATCH', end_to_end_id: null },
    ];
    expect(await exceptionsOn(day), withSeed(`exceptions on ${day}`)).toHaveLength(26);
    expect(new Set(await exceptionsOn(day))).toEqual(new Set(expected));
  }, 300_000);
});
