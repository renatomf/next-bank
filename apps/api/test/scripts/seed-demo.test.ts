import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, inProcess, overHttp, seedDemoAccounts } from '../../scripts/seed-demo.ts';
import { buildApp } from '../../src/app.ts';
import { createPool } from '../../src/shared/db.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../helpers.ts';

// The demo accounts of the public demo (roadmap 8.2; week 8 plan, E2E and
// D5): Ana and Bruno, created through the API's own routes, marked as demo by
// the migration role, and the same after any number of runs.
const pool = createPool(testDatabaseUrl());
const migrator = createPool(testMigrationDatabaseUrl());
let app: FastifyInstance;

beforeAll(() => {
  app = buildApp({ pool, logStream: captureLogs().stream, security: testSecurity() });
});

afterAll(async () => {
  await app.close();
  await migrator.end();
});

function login(email: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password },
    remoteAddress: '203.0.115.1',
  });
}

describe('seedDemoAccounts', () => {
  it('creates Ana and Bruno, signed in by password and unlocked by PIN', async () => {
    await seedDemoAccounts(inProcess(app), migrator);

    for (const account of DEMO_ACCOUNTS) {
      const signedIn = await login(account.email, account.password);
      expect(signedIn.statusCode, account.email).toBe(200);
      const { accessToken } = signedIn.json<{ accessToken: string }>();
      const unlocked = await app.inject({
        method: 'POST',
        url: '/v1/me/pin/verify',
        payload: { pin: account.pin },
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(unlocked.statusCode, account.email).toBe(204);
    }
  });

  it('marks them as demo accounts (DEMO-03)', async () => {
    await seedDemoAccounts(inProcess(app), migrator);

    const { rows } = await migrator.query<{ email: string; is_demo: boolean }>(
      'SELECT email, is_demo FROM identity.users WHERE email = ANY($1) ORDER BY email',
      [DEMO_ACCOUNTS.map((account) => account.email)],
    );
    expect(rows).toEqual(
      DEMO_ACCOUNTS.map((account) => ({ email: account.email, is_demo: true })).sort((a, b) =>
        a.email.localeCompare(b.email),
      ),
    );
  });

  it('keeps one account each, whatever the number of runs', async () => {
    await seedDemoAccounts(inProcess(app), migrator);
    await seedDemoAccounts(inProcess(app), migrator);

    const { rows } = await migrator.query<{ count: string }>(
      'SELECT count(*) FROM identity.users WHERE email = ANY($1)',
      [DEMO_ACCOUNTS.map((account) => account.email)],
    );
    expect(Number(rows[0]?.count)).toBe(DEMO_ACCOUNTS.length);
  });

  it('leaves no session of its own open', async () => {
    const activeSessions = async () => {
      const { rows } = await migrator.query<{ count: string }>(
        `SELECT count(*) FROM identity.sessions s
         JOIN identity.users u ON u.id = s.user_id
        WHERE u.email = ANY($1) AND s.revoked_at IS NULL`,
        [DEMO_ACCOUNTS.map((account) => account.email)],
      );
      return Number(rows[0]?.count);
    };
    const before = await activeSessions();

    await seedDemoAccounts(inProcess(app), migrator);

    expect(await activeSessions()).toBe(before);
  });

  // Week 8 plan, task 3a: the daily reset seeds through the published API, so
  // the production keys never leave the host.
  it('seeds through the API over HTTP as well', async () => {
    const published = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
    });
    await published.listen({ port: 0, host: '127.0.0.1' });
    const address = published.server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    try {
      await seedDemoAccounts(overHttp(`http://127.0.0.1:${String(address.port)}`), migrator);
    } finally {
      await published.close();
    }

    const ana = DEMO_ACCOUNTS[0];
    if (ana === undefined) throw new Error('no demo account');
    expect((await login(ana.email, ana.password)).statusCode).toBe(200);
  });
});
