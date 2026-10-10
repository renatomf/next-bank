import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/me/pin/change against the real database (domain-model.md 3.1:
// Change needs the password; week 7 plan, D5: how a locked PIN is recovered;
// AUTH-01: brute force on the password; AUTH-04: ended sessions).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const PASSWORD = 'violet staple orbit 42';
const OLD_PIN = '2580';
const NEW_PIN = '1597';
const WRONG_PIN = '7413';

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

function newIp(): string {
  return `203.0.113.${String(nextIp++)}`;
}

async function newCustomer(pin: string | null = OLD_PIN) {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email, cpf: fictitiousCpf(), password: PASSWORD },
    remoteAddress: newIp(),
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

function change(accessToken: string, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/pin/change',
    payload,
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

function verify(accessToken: string, pin: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/me/pin/verify',
    payload: { pin },
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

function login(email: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: PASSWORD },
    remoteAddress: newIp(),
  });
}

describe('POST /v1/me/pin/change', () => {
  it('takes the new PIN with the right password', async () => {
    const { accessToken } = await newCustomer();

    const response = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(response.statusCode).toBe(204);
    expect((await verify(accessToken, NEW_PIN)).statusCode).toBe(204);
    expect((await verify(accessToken, OLD_PIN)).statusCode).toBe(422);
  });

  it('keeps the PIN when the password is wrong', async () => {
    const { accessToken } = await newCustomer();

    const response = await change(accessToken, { password: 'not the password', newPin: NEW_PIN });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('PasswordIncorrect');
    expect((await verify(accessToken, OLD_PIN)).statusCode).toBe(204);
  });

  // Week 7 plan, D5: the password recovers a PIN locked for 30 minutes...
  it('recovers a PIN locked by wrong attempts', async () => {
    const { accessToken } = await newCustomer();
    for (let i = 0; i < 5; i++) await verify(accessToken, WRONG_PIN);
    expect((await verify(accessToken, OLD_PIN)).statusCode).toBe(423);

    const response = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(response.statusCode).toBe(204);
    expect((await verify(accessToken, NEW_PIN)).statusCode).toBe(204);
  });

  // ...and one that needs a reset, which nothing else lifts.
  it('recovers a PIN that needs a reset', async () => {
    const { accessToken, email } = await newCustomer();
    await pool.query(
      `UPDATE identity.transaction_pins p SET reset_required = true
       FROM identity.users u WHERE u.id = p.user_id AND u.email = $1`,
      [email],
    );
    expect((await verify(accessToken, OLD_PIN)).json<{ code: string }>().code).toBe(
      'PinResetRequired',
    );

    const response = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(response.statusCode).toBe(204);
    expect((await verify(accessToken, NEW_PIN)).statusCode).toBe(204);
  });

  // AUTH-01 (attack first): wrong passwords here count with the login's, so
  // this route is no side door for guessing the password.
  it('blocks after 5 wrong passwords, for the login too', async () => {
    const { accessToken, email } = await newCustomer();
    for (let i = 0; i < 5; i++) {
      const wrong = await change(accessToken, { password: `wrong ${String(i)}`, newPin: NEW_PIN });
      expect(wrong.statusCode).toBe(422);
    }

    const blocked = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('TooManyAttempts');
    expect((await login(email)).statusCode).toBe(429);
  });

  // F-11: the attempt is counted before the password is hashed, so a burst
  // cannot slip past the limit while earlier guesses are still checked.
  it('checks at most 5 wrong passwords sent at once', async () => {
    const { accessToken } = await newCustomer();

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        change(accessToken, { password: `wrong ${String(i)}`, newPin: NEW_PIN }),
      ),
    );

    const codes = responses.map((response) => response.statusCode);
    expect(codes.filter((code) => code === 422).length).toBeLessThanOrEqual(5);
    expect(codes.filter((code) => code === 429).length).toBeGreaterThanOrEqual(5);
  });

  // A malformed request spends none of the password's attempts.
  it('refuses a trivial new PIN without checking the password', async () => {
    const { accessToken, email } = await newCustomer();
    for (let i = 0; i < 5; i++) {
      const response = await change(accessToken, { password: PASSWORD, newPin: '1234' });
      expect(response.json<{ code: string }>().code).toBe('InvalidPin');
    }

    expect((await login(email)).statusCode).toBe(200);
  });

  it('asks to create a PIN first', async () => {
    const { accessToken } = await newCustomer(null);

    const response = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('PinNotCreated');
  });

  it('records the change in the audit, with neither the PIN nor the password', async () => {
    const { accessToken, email } = await newCustomer();

    await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    const { rows } = await pool.query<{ metadata: unknown }>(
      `SELECT a.metadata FROM audit.audit_events a
       JOIN identity.users u ON u.id = a.subject_id
       WHERE u.email = $1 AND a.action = 'PIN_CHANGED'`,
      [email],
    );
    expect(rows).toHaveLength(1);
    const metadata = JSON.stringify(rows[0]?.metadata);
    expect(metadata).not.toContain(NEW_PIN);
    expect(metadata).not.toContain(PASSWORD);
  });

  it('refuses unknown fields', async () => {
    const { accessToken } = await newCustomer();

    const response = await change(accessToken, {
      password: PASSWORD,
      newPin: NEW_PIN,
      userId: 'someone else',
    });

    expect(response.statusCode).toBe(422);
  });

  // AUTH-04: a token of an ended session cannot change the PIN.
  it('refuses the token of a session that already ended', async () => {
    const { accessToken } = await newCustomer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const response = await change(accessToken, { password: PASSWORD, newPin: NEW_PIN });

    expect(response.statusCode).toBe(401);
  });
});
