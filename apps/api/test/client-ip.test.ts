import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

// API-14 (v1.1.0 plan, task 8): the smoke test asks the published API which
// address it gives the caller, the one the login counters key on, to catch a
// TRUST_PROXY that no longer matches the hops in front of it (F-29).
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

async function clientIp(app: FastifyInstance, forwardedFor?: string): Promise<unknown> {
  const response = await app.inject({
    method: 'GET',
    url: '/health/client-ip',
    remoteAddress: PROXY,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}

describe('GET /health/client-ip', () => {
  it('answers with the hop before the trusted proxy', async () => {
    const app = appTrusting(1);

    expect(await clientIp(app, '198.51.100.7')).toEqual({ ip: '198.51.100.7' });
  });

  it('ignores a forged address before the trusted hop', async () => {
    const app = appTrusting(1);

    // The proxy appends the real client after whatever the client sent.
    expect(await clientIp(app, '203.0.113.66, 198.51.100.7')).toEqual({ ip: '198.51.100.7' });
  });

  it('answers with the peer and ignores X-Forwarded-For when no proxy is trusted', async () => {
    const app = appTrusting(0);

    expect(await clientIp(app, '203.0.113.66')).toEqual({ ip: PROXY });
  });

  it('needs no credentials, like the health check', async () => {
    const app = appTrusting(0);

    const response = await app.inject({ method: 'GET', url: '/health/client-ip' });

    expect(response.statusCode).toBe(200);
  });
});
