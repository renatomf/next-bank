import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// DEMO-03 (threat model; week 8 plan, F-27): the shared demo accounts cannot
// change the password or the PIN, nor end the other visitors' sessions.
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const migrator = createPool(testMigrationDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const PASSWORD = 'violet staple orbit 42';
const PIN = '2580';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
  await migrator.end();
});

function newIp(): string {
  return `203.0.114.${String(nextIp++)}`;
}

/** A demo account as the seed leaves it: registered, with a PIN, marked demo. */
async function demoAccount(): Promise<{ email: string; tokens: Tokens }> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Ana Demo', email, cpf: fictitiousCpf(), password: PASSWORD },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(201);
  const tokens = response.json<Tokens>();
  const created = await app.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin: PIN },
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  expect(created.statusCode).toBe(204);
  // Only the seed, with the migration role, marks an account as demo.
  await migrator.query('UPDATE identity.users SET is_demo = true WHERE email = $1', [email]);
  return { email, tokens };
}

async function login(email: string, password = PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
    remoteAddress: newIp(),
  });
}

function post(tokens: Tokens, url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url,
    ...(payload ? { payload } : {}),
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
}

function expectRestricted(response: LightMyRequestResponse) {
  expect(response.statusCode).toBe(403);
  expect(response.json<{ code: string }>().code).toBe('DemoAccountRestricted');
}

describe('demo accounts (DEMO-03)', () => {
  it('cannot change the PIN, which keeps working', async () => {
    const { tokens } = await demoAccount();

    expectRestricted(
      await post(tokens, '/v1/me/pin/change', { password: PASSWORD, newPin: '1597' }),
    );

    const verified = await post(tokens, '/v1/me/pin/verify', { pin: PIN });
    expect(verified.statusCode).toBe(204);
  });

  it('cannot change the password, which keeps signing in', async () => {
    const { email, tokens } = await demoAccount();

    expectRestricted(
      await post(tokens, '/v1/me/password/change', {
        currentPassword: PASSWORD,
        newPassword: 'another long passphrase',
      }),
    );

    expect((await login(email)).statusCode).toBe(200);
  });

  it('cannot end another session, which keeps renewing', async () => {
    const { email, tokens } = await demoAccount();
    const other = (await login(email)).json<Tokens>();
    const listed = await app.inject({
      method: 'GET',
      url: '/v1/me/sessions',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    const otherId = listed
      .json<{ items: { id: string; current: boolean }[] }>()
      .items.find((session) => !session.current)?.id;
    if (otherId === undefined) throw new Error('no other session');

    expectRestricted(await post(tokens, `/v1/me/sessions/${otherId}/revoke`));

    const renewed = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: other.refreshToken },
    });
    expect(renewed.statusCode).toBe(200);
  });

  it('does not spend the login attempts on a refused change', async () => {
    const { email, tokens } = await demoAccount();

    for (let i = 0; i < 6; i++) {
      expectRestricted(
        await post(tokens, '/v1/me/pin/change', { password: 'wrong guess', newPin: '1597' }),
      );
    }

    expect((await login(email)).statusCode).toBe(200);
  });

  // Defense in depth: the API's role cannot mark or unmark a demo account.
  it('cannot be marked or unmarked by the API role', async () => {
    const { email } = await demoAccount();

    await expect(
      pool.query('UPDATE identity.users SET is_demo = false WHERE email = $1', [email]),
    ).rejects.toThrow(/permission denied/);
  });
});
