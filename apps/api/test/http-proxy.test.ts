import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { uniqueEmail } from './modules/identity/fixtures.ts';

// Behind the deploy proxy (week 8 plan, task 3a): each client keeps its own
// login counter (AUTH-01, API-02), and a forged X-Forwarded-For cannot pick
// another one. The proxy is the only peer the API sees.
const PROXY = '10.0.0.1';
const apps: FastifyInstance[] = [];

function appTrusting(trustProxy: number): FastifyInstance {
  const app = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    trustProxy,
  });
  apps.push(app);
  return app;
}

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
});

function failedLogin(app: FastifyInstance, forwardedFor?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: uniqueEmail(), password: 'not the password' },
    remoteAddress: PROXY,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
}

/** Spends the 10 failed logins one IP may make in a minute. */
async function exhaust(app: FastifyInstance, forwardedFor?: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    expect((await failedLogin(app, forwardedFor)).statusCode).toBe(401);
  }
}

describe('client address behind the proxy', () => {
  it('counts each client on its own with one trusted proxy', async () => {
    const app = appTrusting(1);
    await exhaust(app, '198.51.100.1');

    expect((await failedLogin(app, '198.51.100.1')).statusCode).toBe(429);
    expect((await failedLogin(app, '198.51.100.2')).statusCode).toBe(401);
  });

  it('ignores a forged address before the trusted hop', async () => {
    const app = appTrusting(1);
    await exhaust(app, '198.51.100.3');

    // The proxy appends the real client after whatever the client sent.
    expect((await failedLogin(app, '203.0.113.99, 198.51.100.3')).statusCode).toBe(429);
  });

  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    const app = appTrusting(0);
    await exhaust(app, '198.51.100.4');

    // Every request comes from the same peer, whatever the header says.
    expect((await failedLogin(app, '198.51.100.5')).statusCode).toBe(429);
  });
});
