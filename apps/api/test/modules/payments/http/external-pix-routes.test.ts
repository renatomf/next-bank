import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import {
  AURORA_KEY,
  participantKey,
  type RunningSimulator,
  startSimulator,
} from '../../../simulator.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// The Pix to another bank over HTTP (v1.2.0 plan, task 3), outside-in
// against the real Postgres and the real simulator: the key found in the
// DICT, the debit to the clearing account with the message in the same
// transaction (ADR 0016), and the worker sending it to the SPI once per
// end-to-end id (EXT-03). Only the payer sees it (PIX-01), the payee only
// masked (READ-02), and the key only sealed in the database (P3).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
let simulator: RunningSimulator;
let app: FastifyInstance;
let nextIp = 1;

const PIN = '2580';

beforeAll(async () => {
  simulator = await startSimulator();
  app = buildApp({
    pool,
    logStream: captureLogs().stream,
    security,
    externalPix: { simulatorUrl: simulator.url, participantKey },
  });
});

afterAll(async () => {
  await app.close();
  await simulator.close();
});

const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });

async function newCustomer(target = app) {
  const response = await target.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email: uniqueEmail(),
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: `198.18.9.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  const created = await target.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin: PIN },
    headers: auth(accessToken),
  });
  expect(created.statusCode).toBe(204);
  return accessToken;
}

function lookup(accessToken: string, value = AURORA_KEY, target = app) {
  return target.inject({
    method: 'POST',
    url: '/v1/pix/key-lookups',
    headers: auth(accessToken),
    payload: { type: 'EMAIL', value },
  });
}

async function pixToAurora(accessToken: string, amount = 8_000): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    headers: { ...auth(accessToken), 'idempotency-key': randomUUID() },
    payload: { key: { type: 'EMAIL', value: AURORA_KEY }, amount: { amount, currency: 'BRL' } },
  });
  expect(created.statusCode).toBe(201);
  return created.json<{ id: string }>().id;
}

function authorize(accessToken: string, pixId: string, key = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: `/v1/pix/transfers/${pixId}/authorize`,
    headers: { ...auth(accessToken), 'idempotency-key': key },
    payload: { pin: PIN },
  });
}

async function balanceOf(accessToken: string): Promise<number> {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/me/account',
    headers: auth(accessToken),
  });
  return response.json<{ availableBalance: { amount: number } }>().availableBalance.amount;
}

async function messagesFor(pixId: string) {
  const { rows } = await pool.query<{ type: string; payload: unknown }>(
    "SELECT type, payload FROM platform.outbox_messages WHERE payload->>'transferId' = $1",
    [pixId],
  );
  return rows;
}

async function spiPayment(endToEndId: string) {
  const { rows } = await simulator.pool.query<{
    amount: string;
    payer_ispb: string;
    payee_key: string;
    payee_ispb: string;
  }>(
    `SELECT amount, payer_ispb, payee_key, payee_ispb FROM simulator.payments
     WHERE end_to_end_id = $1`,
    [endToEndId],
  );
  return rows;
}

describe('the Pix to another bank over HTTP', () => {
  it('finds the key in the DICT and names the bank, the payee only masked', async () => {
    const response = await lookup(await newCustomer());

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      keyType: 'EMAIL',
      keyMasked: 'cl***@example.com',
      payeeName: 'Clara Aurora Teixeira',
      payeeDocumentMasked: '***.407.256-**',
      bank: { ispb: '99900001', name: 'Banco Aurora' },
    });
  });

  it('finds no key of another bank while the Pix to other banks is off (P1)', async () => {
    const off = buildApp({ pool: createPool(testDatabaseUrl()), security });
    try {
      const response = await lookup(await newCustomer(off), AURORA_KEY, off);

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'PixKeyNotFound' });
    } finally {
      await off.close();
    }
  });

  it('debits the payer and leaves the Pix processing with one message to send it', async () => {
    const payer = await newCustomer();
    const pixId = await pixToAurora(payer);

    const response = await authorize(payer, pixId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'PROCESSING',
      endToEndId: expect.stringMatching(/^E00000000\d{12}[A-Za-z0-9]{11}$/),
      completedAt: null,
      payee: { keyMasked: 'cl***@example.com', bank: { name: 'Banco Aurora' } },
    });
    expect(await balanceOf(payer)).toBe(1_000_000 - 8_000);
    expect(await messagesFor(pixId)).toEqual([
      { type: 'pix.send-external', payload: { transferId: pixId } },
    ]);
  });

  it('sends the Pix to the SPI from the outbox, with its end-to-end id (EXT-03)', async () => {
    const payer = await newCustomer();
    const pixId = await pixToAurora(payer);
    const { endToEndId } = (await authorize(payer, pixId)).json<{ endToEndId: string }>();

    await app.outboxWorker.runOnce(100);

    expect(await spiPayment(endToEndId)).toEqual([
      {
        amount: '8000',
        payer_ispb: '00000000',
        payee_key: AURORA_KEY,
        payee_ispb: '99900001',
      },
    ]);
  });

  it('shows the Pix sent in the statement, to the payee at the other bank', async () => {
    const payer = await newCustomer();
    await authorize(payer, await pixToAurora(payer));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/statement',
      headers: auth(payer),
    });

    expect(response.json<{ items: unknown[] }>().items[0]).toMatchObject({
      kind: 'PIX_SENT',
      amount: { amount: -8_000 },
      counterparty: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
    });
  });

  it("never shows another customer's Pix to another bank (404, PIX-01)", async () => {
    const payer = await newCustomer();
    const pixId = await pixToAurora(payer);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/pix/transfers/${pixId}`,
      headers: auth(await newCustomer()),
    });

    expect(response.statusCode).toBe(404);
  });

  it('keeps the key in the database only sealed (P3)', async () => {
    const pixId = await pixToAurora(await newCustomer());

    const { rows } = await pool.query<{ sealed: Buffer; row: string }>(
      `SELECT payee_key_ciphertext AS sealed, t::text AS row
       FROM payments.pix_transfers t WHERE id = $1`,
      [pixId],
    );

    expect(rows[0]?.sealed.length).toBeGreaterThan(0);
    expect(rows[0]?.row).not.toContain('clara.aurora');
    expect(rows[0]?.sealed.toString('latin1')).not.toContain('clara.aurora');
  });
});
