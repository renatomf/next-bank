import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/me/pin/verify against the real database (F-16: the Unlock screen;
// PIX-05: brute force on the PIN; AUTH-04: ended sessions).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const RIGHT = '2580';
const WRONG = '7413';

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

async function newCustomer(pin: string | null = RIGHT) {
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
    remoteAddress: `198.18.1.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  if (pin !== null) {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin },
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(created.statusCode).toBe(204);
  }
  return { accessToken, email };
}

function verify(accessToken: string | undefined, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/pin/verify',
    payload,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

async function failedAttempts(email: string): Promise<number | undefined> {
  const { rows } = await pool.query<{ failed_attempts: number }>(
    `SELECT p.failed_attempts FROM identity.transaction_pins p
     JOIN identity.users u ON u.id = p.user_id WHERE u.email = $1`,
    [email],
  );
  return rows[0]?.failed_attempts;
}

describe('POST /v1/me/pin/verify', () => {
  it('answers 204 to the right PIN', async () => {
    const { accessToken } = await newCustomer();

    const response = await verify(accessToken, { pin: RIGHT });

    expect(response.statusCode).toBe(204);
  });

  it('refuses a wrong PIN with the attempts left (PinIncorrect)', async () => {
    const { accessToken } = await newCustomer();

    const response = await verify(accessToken, { pin: WRONG });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 4 });
  });

  it('locks at the 5th wrong PIN, then refuses even the right one (PIX-05)', async () => {
    const { accessToken } = await newCustomer();
    for (let i = 0; i < 4; i++) await verify(accessToken, { pin: WRONG });

    const fifth = await verify(accessToken, { pin: WRONG });
    const sixth = await verify(accessToken, { pin: RIGHT });

    expect(fifth.statusCode).toBe(423);
    expect(fifth.json<{ code: string }>().code).toBe('PinLocked');
    expect(sixth.statusCode).toBe(423);
    expect(sixth.json<{ code: string }>().code).toBe('PinLocked');
  });

  // The counter is locked row by row: parallel guesses cannot slip past it.
  it('counts each of 10 parallel wrong PINs once and locks at the 5th', async () => {
    const { accessToken, email } = await newCustomer();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => verify(accessToken, { pin: WRONG })),
    );

    const statuses = responses.map((response) => response.statusCode).sort();
    expect(statuses).toEqual([422, 422, 422, 422, 423, 423, 423, 423, 423, 423]);
    expect(await failedAttempts(email)).toBe(5);
  });

  it('refuses a customer who has not created the PIN (PinNotCreated)', async () => {
    const { accessToken } = await newCustomer(null);

    const response = await verify(accessToken, { pin: RIGHT });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('PinNotCreated');
  });

  it.each([['12a4'], ['258'], ['25801'], [2580]])(
    'refuses %j without counting an attempt (InvalidRequest)',
    async (pin) => {
      const { accessToken, email } = await newCustomer();

      const response = await verify(accessToken, { pin });

      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
      expect(await failedAttempts(email)).toBe(0);
    },
  );

  it('refuses unknown fields (InvalidRequest)', async () => {
    const { accessToken } = await newCustomer();

    const response = await verify(accessToken, { pin: RIGHT, userId: 'someone-else' });

    expect(response.statusCode).toBe(422);
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await verify(undefined, { pin: RIGHT });

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

    const response = await verify(accessToken, { pin: RIGHT });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('SessionExpired');
  });

  it('records PIN_LOCKED and keeps the PIN out of the logs (API-04)', async () => {
    const { accessToken, email } = await newCustomer('3692');
    for (let i = 0; i < 5; i++) await verify(accessToken, { pin: '9517' });

    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit.audit_events a
       JOIN identity.users u ON u.id = a.subject_id
       WHERE a.action = 'PIN_LOCKED' AND u.email = $1`,
      [email],
    );
    expect(rows[0]?.n).toBe(1);
    expect(logs.raw()).not.toContain('9517');
  });
});
