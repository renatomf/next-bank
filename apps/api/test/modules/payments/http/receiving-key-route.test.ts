import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// POST /v1/me/pix/receiving-key against the real database (v1.1.0 plan,
// task 3; D2): one random key per account, created the first time, never the
// CPF (PIX-12), only for the caller (PIX-01), stored only sealed (API-06).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface ReceivingKey {
  key: string;
  keyMasked: string;
}

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

async function newCustomer(name = 'Bruno Lima') {
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name, email: uniqueEmail(), cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.5.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return { accessToken: response.json<{ accessToken: string }>().accessToken, cpf };
}

function receivingKey(accessToken: string | undefined, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/pix/receiving-key',
    ...(payload === undefined ? {} : { payload }),
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

async function storedRandomKeys(masked: string) {
  const { rows } = await pool.query<{ value_ciphertext: Buffer }>(
    `SELECT value_ciphertext FROM payments.pix_keys WHERE type = 'RANDOM' AND value_masked = $1`,
    [masked],
  );
  return rows;
}

describe('POST /v1/me/pix/receiving-key', () => {
  it('creates a random key with exactly the approved fields, never the CPF (READ-02, PIX-12)', async () => {
    const customer = await newCustomer();

    const response = await receivingKey(customer.accessToken);

    expect(response.statusCode).toBe(200);
    const body = response.json<ReceivingKey>();
    expect(Object.keys(body).sort()).toEqual(['key', 'keyMasked']);
    expect(body.key).toMatch(UUID_V4);
    expect(body.keyMasked).toBe(
      `${body.key.slice(0, 4)}****-****-****-****-********${body.key.slice(-4)}`,
    );
    expect(response.body).not.toContain(customer.cpf.replace(/\D/g, ''));
  });

  it('gives back the same key on every call', async () => {
    const customer = await newCustomer();
    const first = (await receivingKey(customer.accessToken)).json<ReceivingKey>();

    const again = await receivingKey(customer.accessToken);

    expect(again.statusCode).toBe(200);
    expect(first.key).toMatch(UUID_V4);
    expect(again.json()).toEqual(first);
  });

  it('keeps one key when the screen asks ten times at once (D2)', async () => {
    const customer = await newCustomer();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => receivingKey(customer.accessToken)),
    );

    expect(responses.map((response) => response.statusCode)).toEqual(Array(10).fill(200));
    const keys = new Set(responses.map((response) => response.json<ReceivingKey>().key));
    expect(keys.size).toBe(1);
    const [only] = responses.map((response) => response.json<ReceivingKey>());
    expect(await storedRandomKeys(only?.keyMasked ?? '')).toHaveLength(1);
  });

  it('stores the key only encrypted (API-06)', async () => {
    const customer = await newCustomer();
    const { key, keyMasked } = (await receivingKey(customer.accessToken)).json<ReceivingKey>();

    const [stored] = await storedRandomKeys(keyMasked);

    expect(stored?.value_ciphertext.toString('latin1')).not.toContain(key);
  });

  it("never gives one customer another customer's key (PIX-01)", async () => {
    const ana = await newCustomer('Ana Souza');
    const bruno = await newCustomer('Bruno Lima');

    const anaKey = (await receivingKey(ana.accessToken)).json<ReceivingKey>();
    const brunoKey = (await receivingKey(bruno.accessToken)).json<ReceivingKey>();

    expect(brunoKey.key).not.toBe(anaKey.key);
    expect((await receivingKey(ana.accessToken)).json()).toEqual(anaKey);
  });

  it('lets a payer find the customer by the random key, in the lookup quota (PIX-07)', async () => {
    const payer = await newCustomer('Ana Souza');
    const payee = await newCustomer('Bruno Lima');
    const { key, keyMasked } = (await receivingKey(payee.accessToken)).json<ReceivingKey>();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/pix/key-lookups',
      payload: { type: 'RANDOM', value: key.toUpperCase() },
      headers: { authorization: `Bearer ${payer.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      keyType: 'RANDOM',
      keyMasked,
      payeeName: 'Bruno Lima',
    });
  });

  // Bodyless like the other commands (cancel, revoke): whatever is sent is ignored.
  it('never lets a body choose the account (PIX-04)', async () => {
    const ana = await newCustomer('Ana Souza');
    const bruno = await newCustomer('Bruno Lima');
    const anaKey = (await receivingKey(ana.accessToken)).json<ReceivingKey>();

    const response = await receivingKey(bruno.accessToken, {
      accountId: 'account-of-ana',
      customerId: 'user-ana',
      key: anaKey.key,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<ReceivingKey>().key).not.toBe(anaKey.key);
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await receivingKey(undefined);

    expect(response.statusCode).toBe(401);
  });

  it('keeps the key out of the logs (API-04)', async () => {
    const customer = await newCustomer();

    const { key } = (await receivingKey(customer.accessToken)).json<ReceivingKey>();

    expect(key).toMatch(UUID_V4);
    expect(logs.raw()).not.toContain(key);
  });
});
