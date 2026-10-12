// Creates the public demo's accounts, Ana and Bruno (roadmap 8.2; week 8 plan,
// E2E and D5). They go through the API's own routes, in process, so they meet
// every rule a visitor meets; then the migration role marks them as demo
// accounts (DEMO-03), which no route can do. Safe to run any number of times.
// Usage: node --env-file=.env scripts/seed-demo.ts
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { buildApp } from '../src/app.ts';
import { loadConfig } from '../src/shared/config.ts';
import { createPool } from '../src/shared/db.ts';

export interface DemoAccount {
  name: string;
  email: string;
  /** Public on purpose: published in the README for visitors. */
  password: string;
  /** Fictitious, as every CPF of the project; Bruno's is Ana's Pix key. */
  cpf: string;
  pin: string;
}

/** The accounts the README lists for visitors, with fictitious data only. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    name: 'Ana Demo',
    email: 'ana.demo@example.com',
    password: 'demo-ana-next-bank',
    cpf: '11144477735',
    pin: '2580',
  },
  {
    name: 'Bruno Demo',
    email: 'bruno.demo@example.com',
    password: 'demo-bruno-next-bank',
    cpf: '52998224725',
    pin: '1470',
  },
];

// One address for the seed's own requests; well inside every rate limit.
const SEED_ADDRESS = '127.0.0.1';

/** Creates or keeps each account, its PIN and its demo mark. */
export async function seedDemoAccounts(
  app: FastifyInstance,
  migrator: Pool,
  accounts: readonly DemoAccount[] = DEMO_ACCOUNTS,
): Promise<void> {
  for (const account of accounts) {
    const accessToken = await signIn(app, account);
    const pin = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin: account.pin },
      headers: { authorization: `Bearer ${accessToken}` },
    });
    // 409 is a PIN created by an earlier run.
    expectStatus(pin.statusCode, [204, 409], `PIN of ${account.email}`);
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expectStatus(logout.statusCode, [204], `logout of ${account.email}`);
    await migrator.query('UPDATE identity.users SET is_demo = true WHERE email = $1', [
      account.email,
    ]);
  }
}

/** Signs in an account from an earlier run, or registers it. */
async function signIn(app: FastifyInstance, account: DemoAccount): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: account.email, password: account.password },
    remoteAddress: SEED_ADDRESS,
  });
  if (login.statusCode === 200) return login.json<{ accessToken: string }>().accessToken;
  expectStatus(login.statusCode, [401], `login of ${account.email}`);
  const registered = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: account.name,
      email: account.email,
      cpf: account.cpf,
      password: account.password,
    },
    remoteAddress: SEED_ADDRESS,
  });
  expectStatus(registered.statusCode, [201], `registration of ${account.email}`);
  return registered.json<{ accessToken: string }>().accessToken;
}

function expectStatus(actual: number, expected: readonly number[], what: string): void {
  if (!expected.includes(actual)) {
    throw new Error(`Demo seed: ${what} answered ${String(actual)}`);
  }
}

if (import.meta.main) {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is not set (see .env.example)');
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);
  const migrator = createPool(migrationUrl);
  const app = buildApp({
    pool,
    security: {
      accessTokenKeys: config.jwt,
      piiKeys: {
        keyVersion: config.pii.keyVersion,
        encryptionKey: config.pii.encryptionKey,
        hmacKey: config.pii.hmacKey,
      },
      pinPepper: config.pinPepper,
    },
  });
  try {
    await seedDemoAccounts(app, migrator);
  } finally {
    await app.close();
    await migrator.end();
  }
}
