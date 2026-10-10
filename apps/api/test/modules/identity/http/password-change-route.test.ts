import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/me/password/change against the real database (ASVS: the password
// changes with the current one and ends the other sessions; AUTH-06; AUTH-01;
// AUTH-07; AUTH-04; week 7 plan, D4).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const PASSWORD = 'violet staple orbit 42';
const NEW_PASSWORD = 'amber kettle ridge 77';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

function newIp(): string {
  return `192.0.2.${String(100 + (nextIp++ % 150))}`;
}

async function newCustomer(): Promise<{ email: string; tokens: Tokens }> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email, cpf: fictitiousCpf(), password: PASSWORD },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(201);
  return { email, tokens: response.json<Tokens>() };
}

function login(email: string, password = PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
    remoteAddress: newIp(),
  });
}

async function anotherSession(email: string): Promise<Tokens> {
  const response = await login(email);
  expect(response.statusCode).toBe(200);
  return response.json<Tokens>();
}

function change(tokens: Tokens, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/password/change',
    payload,
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
}

function refresh(tokens: Tokens) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: tokens.refreshToken },
  });
}

const valid = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };

describe('POST /v1/me/password/change', () => {
  it('takes the new password: the login takes it, and not the old one', async () => {
    const { email, tokens } = await newCustomer();

    const response = await change(tokens, valid);

    expect(response.statusCode).toBe(204);
    expect((await login(email, NEW_PASSWORD)).statusCode).toBe(200);
    expect((await login(email, PASSWORD)).statusCode).toBe(401);
  });

  // AUTH-06 (attack first): whoever had another session loses it.
  it('ends every other session and keeps the current one', async () => {
    const { email, tokens } = await newCustomer();
    const phone = await anotherSession(email);
    const laptop = await anotherSession(email);

    await change(tokens, valid);

    expect((await refresh(phone)).statusCode).toBe(401);
    expect((await refresh(laptop)).statusCode).toBe(401);
    expect((await refresh(tokens)).statusCode).toBe(200);
  });

  // Concurrency: sessions refreshing during the change still end.
  it('ends the other sessions even while they refresh', async () => {
    const { email, tokens } = await newCustomer();
    const others = await Promise.all(Array.from({ length: 5 }, () => anotherSession(email)));

    const [changed, ...refreshed] = await Promise.all([
      change(tokens, valid),
      ...others.map((other) => refresh(other)),
    ]);

    expect(changed.statusCode).toBe(204);
    // Whoever ran first, no other session renews afterwards.
    for (const [index, response] of refreshed.entries()) {
      const latest = response.statusCode === 200 ? response.json<Tokens>() : others[index];
      if (latest === undefined) throw new Error('missing session');
      expect((await refresh(latest)).statusCode).toBe(401);
    }
  });

  it('keeps everything when the current password is wrong', async () => {
    const { email, tokens } = await newCustomer();
    const phone = await anotherSession(email);

    const response = await change(tokens, { ...valid, currentPassword: 'not the password' });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('PasswordIncorrect');
    expect((await refresh(phone)).statusCode).toBe(200);
    expect((await login(email, PASSWORD)).statusCode).toBe(200);
  });

  // AUTH-01: wrong current passwords count with the login's.
  it('blocks after 5 wrong passwords, for the login too', async () => {
    const { email, tokens } = await newCustomer();
    for (let i = 0; i < 5; i++) {
      const wrong = await change(tokens, { ...valid, currentPassword: `wrong ${String(i)}` });
      expect(wrong.statusCode).toBe(422);
    }

    const blocked = await change(tokens, valid);

    expect(blocked.statusCode).toBe(429);
    expect((await login(email)).statusCode).toBe(429);
  });

  // AUTH-07, AUTH-08: the new password follows the policy, and a refused one
  // spends none of the attempts.
  for (const [name, newPassword] of [
    ['too short', 'short'],
    ['common', 'password123'],
    ['over 128 characters', 'a'.repeat(129)],
  ] as const) {
    it(`refuses a new password ${name}`, async () => {
      const { email, tokens } = await newCustomer();

      const response = await change(tokens, { ...valid, newPassword });

      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('WeakPassword');
      expect((await login(email, PASSWORD)).statusCode).toBe(200);
    });
  }

  it('records the change and each ended session, without passwords', async () => {
    const { email, tokens } = await newCustomer();
    await anotherSession(email);

    await change(tokens, valid);

    const { rows } = await pool.query<{ action: string; metadata: unknown }>(
      `SELECT a.action, a.metadata FROM audit.audit_events a
       JOIN identity.users u ON u.id = a.actor_id
       WHERE u.email = $1 AND a.action IN ('PASSWORD_CHANGED', 'SESSION_REVOKED')
       ORDER BY a.action`,
      [email],
    );
    expect(rows).toEqual([
      { action: 'PASSWORD_CHANGED', metadata: { endedSessions: 1 } },
      { action: 'SESSION_REVOKED', metadata: { reason: 'PASSWORD_CHANGED' } },
    ]);
    const text = JSON.stringify(rows);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain(NEW_PASSWORD);
  });

  it('refuses unknown fields', async () => {
    const { tokens } = await newCustomer();

    const response = await change(tokens, { ...valid, userId: 'someone else' });

    expect(response.statusCode).toBe(422);
  });

  // AUTH-04: a token of an ended session cannot change the password.
  it('refuses the token of a session that already ended', async () => {
    const { tokens } = await newCustomer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    const response = await change(tokens, valid);

    expect(response.statusCode).toBe(401);
  });
});
