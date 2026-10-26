import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { participantKey, type RunningSimulator, startSimulator } from '../../../simulator.ts';
import { externalPixClient, signedWebhook } from './external-pix-client.ts';

// POST /v1/spi/webhooks (v1.2.0 plan, task 4), outside-in against the real
// Postgres: only a webhook signed by the SPI is taken (EXT-01), each event
// once even when it comes ten times at once (EXT-02); settled, the Pix
// completes; refused, the payer gets the money back (D6). Neither the
// signature nor the body reaches the log (API-04).
const pool = createPool(testDatabaseUrl());
const webhookSecret = randomBytes(32);
const logs = captureLogs();
let simulator: RunningSimulator;
let app: FastifyInstance;
let client: ReturnType<typeof externalPixClient>;

beforeAll(async () => {
  simulator = await startSimulator();
  app = buildApp({
    pool,
    logStream: logs.stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: simulator.url, participantKey, webhookSecret },
  });
  client = externalPixClient(app, '198.18.10');
});

afterAll(async () => {
  await app.close();
  await simulator.close();
});

function deliver(
  event: Record<string, unknown>,
  options: { secret?: Uint8Array; at?: number } = {},
) {
  const { body, headers } = signedWebhook(options.secret ?? webhookSecret, event, options.at);
  return app.inject({ method: 'POST', url: '/v1/spi/webhooks', headers, payload: body });
}

const answer = (endToEndId: string, status: 'SETTLED' | 'REJECTED', eventId = randomUUID()) => ({
  eventId,
  version: 1,
  endToEndId,
  status,
  ...(status === 'REJECTED' ? { reason: 'PAYEE_BANK_REJECTED' } : {}),
  occurredAt: new Date().toISOString(),
});

async function entries(pixId: string, kind: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ledger.journal_entries
     WHERE reference_type = 'PIX_TRANSFER' AND reference_id = $1 AND kind = $2`,
    [pixId, kind],
  );
  return rows[0]?.n ?? 0;
}

describe('POST /v1/spi/webhooks', () => {
  it('completes a settled Pix and moves its money to the settlement account', async () => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    const response = await deliver(answer(pix.endToEndId, 'SETTLED'));

    expect(response.statusCode).toBe(200);
    expect(await client.pix(payer, pix.id)).toMatchObject({ status: 'COMPLETED' });
    expect(await entries(pix.id, 'PIX_EXTERNAL_SETTLEMENT')).toBe(1);
    expect(await client.balanceOf(payer)).toBe(1_000_000 - 8_000);
  });

  it('fails a refused Pix and gives the payer the money back (D6)', async () => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    const response = await deliver(answer(pix.endToEndId, 'REJECTED'));

    expect(response.statusCode).toBe(200);
    expect(await client.pix(payer, pix.id)).toMatchObject({
      status: 'FAILED',
      failureReason: 'PAYEE_BANK_REJECTED',
    });
    expect(await client.balanceOf(payer)).toBe(1_000_000);
    const statement = await app.inject({
      method: 'GET',
      url: '/v1/me/statement',
      headers: client.auth(payer),
    });
    expect(statement.json<{ items: { kind: string }[] }>().items[0]?.kind).toBe('PIX_REFUNDED');
  });

  // EXT-02: the SPI may deliver the same event many times, even at once.
  it('takes the same event once, even ten times at once', async () => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);
    const event = answer(pix.endToEndId, 'SETTLED');

    const responses = await Promise.all(Array.from({ length: 10 }, () => deliver(event)));

    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(await entries(pix.id, 'PIX_EXTERNAL_SETTLEMENT')).toBe(1);
  });

  it('ignores a refusal after the settlement, and keeps the money where it is', async () => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);
    await deliver(answer(pix.endToEndId, 'SETTLED'));

    const late = await deliver(answer(pix.endToEndId, 'REJECTED'));

    expect(late.statusCode).toBe(200);
    expect(await client.pix(payer, pix.id)).toMatchObject({ status: 'COMPLETED' });
    expect(await entries(pix.id, 'PIX_EXTERNAL_REFUND')).toBe(0);
  });

  it('answers 200 to an event for a Pix it does not know, changing nothing', async () => {
    const response = await deliver(answer('E00000000202610261501zzzzzzzzzzz', 'SETTLED'));

    expect(response.statusCode).toBe(200);
  });

  // EXT-01: only the SPI, which holds the secret, can end a Pix.
  it.each([
    ['another secret', { secret: randomBytes(32) }],
    ['a replayed signature, 6 minutes old', { at: Math.floor(Date.now() / 1000) - 360 }],
  ])('refuses a webhook signed with %s, changing nothing', async (_case, options) => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    const response = await deliver(answer(pix.endToEndId, 'SETTLED'), options);

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(await client.pix(payer, pix.id)).toMatchObject({ status: 'PROCESSING' });
  });

  it('refuses a webhook with no signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/spi/webhooks',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(answer('E00000000202610261501zzzzzzzzzzz', 'SETTLED')),
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a signed body that is not an SPI event (422)', async () => {
    const response = await deliver({ eventId: 'not-a-uuid', status: 'PAID' });

    expect(response.statusCode).toBe(422);
  });

  it('never logs the signature nor the body', async () => {
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);
    const { body, headers } = signedWebhook(webhookSecret, answer(pix.endToEndId, 'SETTLED'));

    await app.inject({ method: 'POST', url: '/v1/spi/webhooks', headers, payload: body });

    const signature = headers['x-simulator-signature'] ?? '';
    expect(logs.raw()).not.toContain(signature.slice(-64));
    expect(logs.raw()).not.toContain(pix.endToEndId);
  });
});
