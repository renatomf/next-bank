import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// GET /v1/pix/transfers/{transferId} and POST .../cancel against the real
// database (screens 8 and 10; D3: the id is in the path, so every route has
// its IDOR test, PIX-01; PIX-08; AUTH-04).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({ pool, logStream: captureLogs().stream, security });
});

afterAll(async () => {
  await app.close();
});

async function newCustomer() {
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email: uniqueEmail(), cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.4.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return { accessToken: response.json<{ accessToken: string }>().accessToken, cpf };
}

const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });

/** A, B and a Pix from A to B awaiting the PIN. */
async function pixFromAToB() {
  const payer = await newCustomer();
  const payee = await newCustomer();
  const created = await app.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    headers: { ...auth(payer.accessToken), 'idempotency-key': randomUUID() },
    payload: { key: { type: 'CPF', value: payee.cpf }, amount: { amount: 8_000, currency: 'BRL' } },
  });
  expect(created.statusCode).toBe(201);
  return { payer, payee, pix: created.json<{ id: string }>() };
}

const receipt = (accessToken: string, id: string) =>
  app.inject({ method: 'GET', url: `/v1/pix/transfers/${id}`, headers: auth(accessToken) });

const cancel = (accessToken: string, id: string) =>
  app.inject({ method: 'POST', url: `/v1/pix/transfers/${id}/cancel`, headers: auth(accessToken) });

describe('GET /v1/pix/transfers/{transferId}', () => {
  it('shows the payer the Pix as created', async () => {
    const { payer, pix } = await pixFromAToB();

    const response = await receipt(payer.accessToken, pix.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(pix);
  });

  // PIX-01: the payee and any other customer get the same answer as for no Pix.
  it("answers 404 to the payee and to a stranger, as for a Pix that doesn't exist", async () => {
    const { payee, pix } = await pixFromAToB();
    const stranger = await newCustomer();

    for (const response of [
      await receipt(payee.accessToken, pix.id),
      await receipt(stranger.accessToken, pix.id),
      await receipt(stranger.accessToken, randomUUID()),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json<{ code: string }>().code).toBe('NotFound');
    }
  });

  it('refuses an id that is not a UUID (InvalidRequest)', async () => {
    const { payer } = await pixFromAToB();

    const response = await receipt(payer.accessToken, '1 OR 1=1');

    expect(response.statusCode).toBe(422);
  });
});

describe('POST /v1/pix/transfers/{transferId}/cancel', () => {
  it('cancels a Pix awaiting the PIN, and the receipt shows it', async () => {
    const { payer, pix } = await pixFromAToB();

    const response = await cancel(payer.accessToken, pix.id);

    expect(response.statusCode).toBe(200);
    expect(response.json<{ status: string }>().status).toBe('CANCELLED');
    expect((await receipt(payer.accessToken, pix.id)).json<{ status: string }>().status).toBe(
      'CANCELLED',
    );
  });

  it('refuses to cancel twice (InvalidTransferState, PIX-08)', async () => {
    const { payer, pix } = await pixFromAToB();
    await cancel(payer.accessToken, pix.id);

    const response = await cancel(payer.accessToken, pix.id);

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('InvalidTransferState');
  });

  it("never cancels someone else's Pix (404, PIX-01)", async () => {
    const { payer, payee, pix } = await pixFromAToB();

    const response = await cancel(payee.accessToken, pix.id);

    expect(response.statusCode).toBe(404);
    expect((await receipt(payer.accessToken, pix.id)).json<{ status: string }>().status).toBe(
      'AWAITING_AUTH',
    );
  });

  it('refuses a still-valid access token of a session that already ended (AUTH-04)', async () => {
    const { payer, pix } = await pixFromAToB();
    await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth(payer.accessToken) });

    const response = await cancel(payer.accessToken, pix.id);

    expect(response.statusCode).toBe(401);
  });
});
