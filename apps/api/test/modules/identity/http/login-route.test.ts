import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { JoseAccessTokens } from '../../../../src/modules/identity/infrastructure/jose-access-tokens.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/auth/login against the real database, keys and Argon2id
// (ADR 0004, AUTH-01, AUTH-02, AUTH-03, API-04, READ-02).
const PASSWORD = 'violet staple orbit 42';
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

function newIp(): string {
  return `203.0.113.${String(nextIp++)}`;
}

async function registeredEmail(): Promise<string> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email, cpf: fictitiousCpf(), password: PASSWORD },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(201);
  return email;
}

function login(body: Record<string, unknown>, ip = newIp(), requestId?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: body,
    remoteAddress: ip,
    headers: requestId ? { 'x-request-id': requestId } : {},
  });
}

async function userIdOf(email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM identity.users WHERE email = $1',
    [email],
  );
  return rows[0]?.id ?? '';
}

describe('POST /v1/auth/login', () => {
  it('answers 200 with only the four token fields and a working access token (READ-02)', async () => {
    const email = await registeredEmail();

    const response = await login({ email, password: PASSWORD, deviceLabel: 'Pixel 8' });

    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, string>>();
    expect(Object.keys(body).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresAt',
      'refreshToken',
      'tokenType',
    ]);
    const verified = await new JoseAccessTokens(security.accessTokenKeys).verify(
      body.accessToken ?? '',
      new Date(),
    );
    expect(verified.userId).toBe(await userIdOf(email));
  });

  it('opens a new session on every login (AUTH-03)', async () => {
    const email = await registeredEmail();

    await login({ email, password: PASSWORD });
    await login({ email, password: PASSWORD });

    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM identity.sessions WHERE user_id = $1',
      [await userIdOf(email)],
    );
    // One from registration, one per login.
    expect(rows[0]?.n).toBe(3);
  });

  it('answers the same 401 body for a wrong password and an unknown e-mail (AUTH-02)', async () => {
    const email = await registeredEmail();

    const wrongPassword = await login({ email, password: 'wrong password here' });
    const unknownEmail = await login({ email: uniqueEmail(), password: PASSWORD });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.body).toBe(unknownEmail.body);
    expect(wrongPassword.json<{ code: string }>().code).toBe('InvalidCredentials');
  });

  it('refuses a locked account with the same 401 body', async () => {
    const email = await registeredEmail();
    await pool.query(`UPDATE identity.users SET status = 'LOCKED' WHERE email = $1`, [email]);

    const locked = await login({ email, password: PASSWORD });
    const unknownEmail = await login({ email: uniqueEmail(), password: PASSWORD });

    expect(locked.statusCode).toBe(401);
    expect(locked.body).toBe(unknownEmail.body);
  });

  it('commits LOGIN_FAILED with the request id even though the answer is 401', async () => {
    const email = await registeredEmail();
    const requestId = '0199bbbb-0000-7000-8000-00000000fa11';

    await login({ email, password: 'wrong password here' }, newIp(), requestId);

    const { rows } = await pool.query<{ actor_type: string; metadata: unknown }>(
      `SELECT actor_type, metadata FROM audit.audit_events
       WHERE action = 'LOGIN_FAILED' AND request_id = $1`,
      [requestId],
    );
    expect(rows).toEqual([{ actor_type: 'SYSTEM', metadata: { reason: 'INVALID_PASSWORD' } }]);
  });

  it('blocks the 6th wrong attempt on one account within a minute, from any IP (AUTH-01)', async () => {
    const email = await registeredEmail();
    for (let i = 0; i < 5; i++) {
      expect((await login({ email, password: 'wrong password here' })).statusCode).toBe(401);
    }

    const blocked = await login({ email, password: PASSWORD });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('TooManyAttempts');
  });

  it('blocks the 11th attempt from one IP within a minute, across accounts (AUTH-01)', async () => {
    const ip = newIp();
    for (let i = 0; i < 10; i++) {
      expect((await login({ email: uniqueEmail(), password: PASSWORD }, ip)).statusCode).toBe(401);
    }

    const blocked = await login({ email: uniqueEmail(), password: PASSWORD }, ip);
    const otherClient = await login({ email: uniqueEmail(), password: PASSWORD });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('TooManyAttempts');
    expect(otherClient.statusCode).toBe(401);
  });

  it.each([
    ['an unknown field', { userId: 'someone-else' }],
    ['a 10,000-character password', { password: 'a'.repeat(10_000) }],
    ['an invalid e-mail', { email: 'not-an-email' }],
  ])('refuses %s before any verification (InvalidRequest)', async (_case, change) => {
    const response = await login({ email: uniqueEmail(), password: PASSWORD, ...change });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('keeps the password and the e-mail out of the logs (API-04)', async () => {
    const email = await registeredEmail();
    await login({ email, password: PASSWORD });
    await login({ email, password: 'another secret phrase' });

    const output = logs.raw();
    for (const secret of [PASSWORD, 'another secret phrase', email]) {
      expect(output).not.toContain(secret);
    }
  });
});
