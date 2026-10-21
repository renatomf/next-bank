// Creates the public demo's accounts, Ana and Bruno (roadmap 8.2; week 8 plan,
// E2E and D5). They go through the API's own routes, in process, so they meet
// every rule a visitor meets; then the migration role marks them as demo
// accounts (DEMO-03), which no route can do. Safe to run any number of times.
// Usage: pnpm seed:demo (locally), or with SEED_API_URL for the published API.
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

// One address for the seed's own in-process requests; well inside every rate limit.
const SEED_ADDRESS = '127.0.0.1';

/** One call to the API: the seed needs nothing more. */
export type ApiCall = (request: {
  url: string;
  payload?: Record<string, unknown>;
  token?: string;
}) => Promise<{ status: number; body: unknown }>;

/** The API in this process, as the tests and local development use it. */
export function inProcess(app: FastifyInstance): ApiCall {
  return async ({ url, payload, token }) => {
    const response = await app.inject({
      method: 'POST',
      url,
      ...(payload ? { payload } : {}),
      ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      remoteAddress: SEED_ADDRESS,
    });
    return { status: response.statusCode, body: response.body ? response.json() : null };
  };
}

/**
 * The published API, as the daily reset uses it (week 8 plan, task 3a): the
 * production keys stay on the host, and the seed meets the same proxy and
 * limits as a visitor.
 */
export function overHttp(baseUrl: string): ApiCall {
  return async ({ url, payload, token }) => {
    const response = await fetch(new URL(url, baseUrl), {
      method: 'POST',
      headers: {
        ...(payload ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
  };
}

/** Creates or keeps each account, its PIN and its demo mark. */
export async function seedDemoAccounts(
  api: ApiCall,
  migrator: Pool,
  accounts: readonly DemoAccount[] = DEMO_ACCOUNTS,
): Promise<void> {
  for (const account of accounts) {
    const token = await signIn(api, account);
    const pin = await api({ url: '/v1/me/pin', payload: { pin: account.pin }, token });
    // 409 is a PIN created by an earlier run.
    expectStatus(pin.status, [204, 409], `PIN of ${account.email}`);
    const logout = await api({ url: '/v1/auth/logout', token });
    expectStatus(logout.status, [204], `logout of ${account.email}`);
    await migrator.query('UPDATE identity.users SET is_demo = true WHERE email = $1', [
      account.email,
    ]);
  }
}

/** Signs in an account from an earlier run, or registers it. */
async function signIn(api: ApiCall, account: DemoAccount): Promise<string> {
  const login = await api({
    url: '/v1/auth/login',
    payload: { email: account.email, password: account.password },
  });
  if (login.status === 200) return accessTokenOf(login.body);
  expectStatus(login.status, [401], `login of ${account.email}`);
  const registered = await api({
    url: '/v1/auth/register',
    payload: {
      name: account.name,
      email: account.email,
      cpf: account.cpf,
      password: account.password,
    },
  });
  expectStatus(registered.status, [201], `registration of ${account.email}`);
  return accessTokenOf(registered.body);
}

function accessTokenOf(body: unknown): string {
  const token = (body as { accessToken?: unknown } | null)?.accessToken;
  if (typeof token !== 'string') throw new Error('Demo seed: no access token in the answer');
  return token;
}

function expectStatus(actual: number, expected: readonly number[], what: string): void {
  if (!expected.includes(actual)) {
    throw new Error(`Demo seed: ${what} answered ${String(actual)}`);
  }
}

// Locally: the API in process (needs the API's keys in .env). Against the
// published API: SEED_API_URL, and only the migration URL besides it.
if (import.meta.main) {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is not set (see .env.example)');
  const migrator = createPool(migrationUrl);
  const publishedUrl = process.env.SEED_API_URL;
  try {
    if (publishedUrl) {
      await seedDemoAccounts(overHttp(publishedUrl), migrator);
    } else {
      const config = loadConfig(process.env);
      const app = buildApp({
        pool: createPool(config.databaseUrl),
        security: {
          accessTokenKeys: config.jwt,
          piiKeys: {
            keyVersion: config.pii.keyVersion,
            encryptionKey: config.pii.encryptionKey,
            hmacKey: config.pii.hmacKey,
          },
          pinPepper: config.pinPepper,
          topUpPhoneKey: config.topUpPhoneKey,
        },
      });
      try {
        await seedDemoAccounts(inProcess(app), migrator);
      } finally {
        await app.close();
      }
    }
  } finally {
    await migrator.end();
  }
}
