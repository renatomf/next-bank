import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/me/pin against the real database and keys (domain-model.md 8,
// D7, AUTH-04, API-13).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

async function newCustomer(): Promise<{ accessToken: string; email: string }> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email,
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: `198.18.0.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return { accessToken: response.json<{ accessToken: string }>().accessToken, email };
}

function createPin(accessToken: string | undefined, pin: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin },
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

async function storedPinHash(email: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ pin_hash: string }>(
    `SELECT p.pin_hash FROM identity.transaction_pins p
     JOIN identity.users u ON u.id = p.user_id WHERE u.email = $1`,
    [email],
  );
  return rows[0]?.pin_hash;
}

describe('POST /v1/me/pin', () => {
  it('creates the PIN: 204, stored only as an Argon2id hash', async () => {
    const { accessToken, email } = await newCustomer();

    const response = await createPin(accessToken, '2580');

    expect(response.statusCode).toBe(204);
    const hash = await storedPinHash(email);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('2580');
  });

  it('refuses a trivial PIN (InvalidPin)', async () => {
    const { accessToken } = await newCustomer();

    const response = await createPin(accessToken, '1234');

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidPin');
  });

  it('refuses a second PIN: changing it needs the password (PinAlreadyCreated)', async () => {
    const { accessToken } = await newCustomer();
    await createPin(accessToken, '2580');

    const response = await createPin(accessToken, '7413');

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('PinAlreadyCreated');
  });

  it('lets exactly one of two simultaneous creations succeed', async () => {
    const { accessToken } = await newCustomer();

    const responses = await Promise.all([
      createPin(accessToken, '2580'),
      createPin(accessToken, '7413'),
    ]);

    expect(responses.map((r) => r.statusCode).sort()).toEqual([204, 409]);
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await createPin(undefined, '2580');

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('Unauthenticated');
  });

  it('refuses a still-valid access token of a session that already ended (AUTH-04)', async () => {
    const { accessToken } = await newCustomer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const response = await createPin(accessToken, '2580');

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('SessionExpired');
  });

  it('refuses unknown fields (InvalidRequest)', async () => {
    const { accessToken } = await newCustomer();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin: '2580', userId: 'someone-else' },
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('records PIN_CREATED and keeps the PIN out of the logs (API-04)', async () => {
    const { accessToken, email } = await newCustomer();
    await createPin(accessToken, '3691');

    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit.audit_events a
       JOIN identity.users u ON u.id = a.subject_id
       WHERE a.action = 'PIN_CREATED' AND u.email = $1`,
      [email],
    );
    expect(rows[0]?.n).toBe(1);
    expect(logs.raw()).not.toContain('3691');
  });
});
