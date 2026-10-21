import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// POST /v1/pix/transfers/{transferId}/authorize against the real database, the
// real Argon2id and the real ledger (database.md 7; PIX-01, PIX-02, PIX-05,
// PIX-08, PIX-09; AUTH-04; API-04).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const PIN = '2580';

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });

async function newCustomer(pin: string | null = PIN) {
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email: uniqueEmail(), cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.5.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  if (pin !== null) {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin },
      headers: auth(accessToken),
    });
    expect(created.statusCode).toBe(204);
  }
  return { accessToken, cpf };
}

async function pixFromAToB(amount = 8_000, payerPin: string | null = PIN) {
  const payer = await newCustomer(payerPin);
  const payee = await newCustomer();
  const created = await app.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    headers: { ...auth(payer.accessToken), 'idempotency-key': randomUUID() },
    payload: { key: { type: 'CPF', value: payee.cpf }, amount: { amount, currency: 'BRL' } },
  });
  expect(created.statusCode).toBe(201);
  return { payer, payee, pixId: created.json<{ id: string }>().id };
}

function authorize(accessToken: string, pixId: string, pin: unknown, key = randomUUID()) {
  return app.inject({
    method: 'POST',
    url: `/v1/pix/transfers/${pixId}/authorize`,
    headers: { ...auth(accessToken), 'idempotency-key': key },
    payload: { pin },
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

async function entriesOf(pixId: string): Promise<number | undefined> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ledger.journal_entries
     WHERE reference_type = 'PIX_TRANSFER' AND reference_id = $1`,
    [pixId],
  );
  return rows[0]?.n;
}

describe('POST /v1/pix/transfers/{transferId}/authorize', () => {
  it('moves the money with the right PIN: 200 COMPLETED, one entry, both balances', async () => {
    const { payer, payee, pixId } = await pixFromAToB(8_000);

    const response = await authorize(payer.accessToken, pixId, PIN);

    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; endToEndId: string; completedAt: string }>();
    expect(body.status).toBe('COMPLETED');
    expect(body.endToEndId).toMatch(/^E00000000\d{12}[A-Za-z0-9]{11}$/);
    expect(await entriesOf(pixId)).toBe(1);
    expect(await balanceOf(payer.accessToken)).toBe(1_000_000 - 8_000);
    expect(await balanceOf(payee.accessToken)).toBe(1_000_000 + 8_000);
  });

  it('records PIX_COMPLETED with the session and the request (PIX-09)', async () => {
    const { payer, pixId } = await pixFromAToB();

    const response = await authorize(payer.accessToken, pixId, PIN);

    const { rows } = await pool.query<{ request_id: string; metadata: { sessionId?: string } }>(
      `SELECT request_id, metadata FROM audit.audit_events
       WHERE action = 'PIX_COMPLETED' AND subject_id = $1`,
      [pixId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.request_id).toBe(response.headers['x-request-id']);
    expect(rows[0]?.metadata.sessionId).toEqual(expect.any(String));
  });

  it('refuses a wrong PIN with the attempts left and moves nothing (PinIncorrect)', async () => {
    const { payer, pixId } = await pixFromAToB();

    const response = await authorize(payer.accessToken, pixId, '7413');

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 4 });
    expect(await entriesOf(pixId)).toBe(0);
    expect(await balanceOf(payer.accessToken)).toBe(1_000_000);
  });

  // PIX-05: one counter per customer, shared with the Unlock screen and every Pix.
  it('locks at the 5th wrong PIN counted across Unlock and Pix, and cancels the Pix', async () => {
    const { payer, pixId } = await pixFromAToB();
    for (let i = 0; i < 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/me/pin/verify',
        headers: auth(payer.accessToken),
        payload: { pin: '7413' },
      });
    }
    for (let i = 0; i < 2; i++) await authorize(payer.accessToken, pixId, '7413');

    const fifth = await authorize(payer.accessToken, pixId, '7413');

    expect(fifth.statusCode).toBe(423);
    expect(fifth.json<{ code: string }>().code).toBe('PinLocked');
    const receipt = await app.inject({
      method: 'GET',
      url: `/v1/pix/transfers/${pixId}`,
      headers: auth(payer.accessToken),
    });
    expect(receipt.json<{ status: string }>().status).toBe('CANCELLED');
  });

  // PIX-02: a lost answer is retried with the same key; the money moves once.
  it('answers a repeated request with the same response and one entry', async () => {
    const { payer, pixId } = await pixFromAToB();
    const key = randomUUID();

    const first = await authorize(payer.accessToken, pixId, PIN, key);
    const again = await authorize(payer.accessToken, pixId, PIN, key);

    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await entriesOf(pixId)).toBe(1);
  });

  // PIX-08: two authorizations of one Pix at once: the row lock lets one through.
  it('lets one of two simultaneous authorizations through; the other gets 409', async () => {
    const { payer, pixId } = await pixFromAToB();

    const responses = await Promise.all([
      authorize(payer.accessToken, pixId, PIN),
      authorize(payer.accessToken, pixId, PIN),
    ]);

    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(await entriesOf(pixId)).toBe(1);
  });

  it('refuses an expired Pix and cancels it (TransferExpired, PIX-08)', async () => {
    const { payer, pixId } = await pixFromAToB();
    // Only the migration role may move these dates; the API role never can.
    const owner = new pg.Client({ connectionString: testMigrationDatabaseUrl() });
    await owner.connect();
    try {
      await owner.query(
        `UPDATE payments.pix_transfers
         SET created_at = now() - interval '11 minutes', expires_at = now() - interval '1 minute'
         WHERE id = $1`,
        [pixId],
      );
    } finally {
      await owner.end();
    }

    const response = await authorize(payer.accessToken, pixId, PIN);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('TransferExpired');
    expect(await entriesOf(pixId)).toBe(0);
  });

  it("never authorizes someone else's Pix (404, PIX-01)", async () => {
    const { payee, pixId } = await pixFromAToB();

    const response = await authorize(payee.accessToken, pixId, PIN);

    expect(response.statusCode).toBe(404);
    expect(await entriesOf(pixId)).toBe(0);
  });

  it('refuses a customer who has not created the PIN (PinNotCreated)', async () => {
    const { payer, pixId } = await pixFromAToB(8_000, null);

    const response = await authorize(payer.accessToken, pixId, PIN);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('PinNotCreated');
  });

  it.each([['12a4'], ['258'], [2580], [null]])(
    'refuses the PIN %j before any check (InvalidRequest)',
    async (pin) => {
      const { payer, pixId } = await pixFromAToB();

      const response = await authorize(payer.accessToken, pixId, pin);

      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
    },
  );

  it('refuses a still-valid access token of a session that already ended (AUTH-04)', async () => {
    const { payer, pixId } = await pixFromAToB();
    await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth(payer.accessToken) });

    const response = await authorize(payer.accessToken, pixId, PIN);

    expect(response.statusCode).toBe(401);
    expect(await entriesOf(pixId)).toBe(0);
  });

  it('keeps the PIN out of the logs and the stored responses (API-04, D4)', async () => {
    const { payer, pixId } = await pixFromAToB();
    const key = randomUUID();

    await authorize(payer.accessToken, pixId, '9516', key);

    expect(logs.raw()).not.toContain('"9516"');
    const { rows } = await pool.query<{ body: string }>(
      'SELECT response_body::text AS body FROM platform.idempotency_records WHERE key = $1',
      [key],
    );
    expect(rows[0]?.body).not.toContain('9516');
  });
});
