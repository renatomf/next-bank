import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { mountSimulator } from '../src/mount-simulator.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { participantKey } from './simulator.ts';

// The calls inside the service (v1.2.0 plan, task 9, C7; F-44): the API
// calling the mounted simulator and the simulator posting its webhooks all
// come from 127.0.0.1, and shared one counter of the global rate limit
// (ADR 0017); under load, the Pix to other banks stopped. Those calls skip
// the limit; anything from outside, which comes through the proxy, keeps it
// (API-02).
let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function service(): Promise<FastifyInstance> {
  const databaseUrl = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  const webhookSecret = randomBytes(32);
  const server = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: 'http://127.0.0.1:9/simulator', participantKey, webhookSecret },
  });
  app = server;
  await mountSimulator(server, {
    databaseUrl,
    participantKey,
    webhookSecret,
    webhookUrl: 'http://127.0.0.1:9/v1/spi/webhooks',
  });
  return server;
}

/** The statuses of [times] calls, past the global limit of 100 a minute. */
async function statusesOf(
  server: FastifyInstance,
  call: {
    method: 'GET' | 'POST';
    url: string;
    remoteAddress?: string;
    headers?: Record<string, string>;
  },
  times = 110,
): Promise<Set<number>> {
  const statuses = new Set<number>();
  for (let i = 0; i < times; i += 1) {
    const response = await server.inject({
      ...call,
      ...(call.method === 'POST'
        ? { payload: '{}', headers: { ...call.headers, 'content-type': 'application/json' } }
        : {}),
    });
    statuses.add(response.statusCode);
  }
  return statuses;
}

describe('the global rate limit and the calls inside the service', () => {
  it('lets the API call the mounted simulator past the limit', async () => {
    const server = await service();

    expect(await statusesOf(server, { method: 'GET', url: '/simulator/health' })).not.toContain(
      429,
    );
  });

  it('lets the mounted simulator post its webhooks past the limit', async () => {
    const server = await service();

    expect(await statusesOf(server, { method: 'POST', url: '/v1/spi/webhooks' })).not.toContain(
      429,
    );
  });

  it('limits the simulator called from outside the service', async () => {
    const server = await service();

    expect(
      await statusesOf(server, {
        method: 'GET',
        url: '/simulator/health',
        remoteAddress: '198.18.40.1',
      }),
    ).toContain(429);
  });

  it('limits a call through the proxy, even when the proxy is on this machine', async () => {
    const server = await service();

    expect(
      await statusesOf(server, {
        method: 'POST',
        url: '/v1/spi/webhooks',
        headers: { 'x-forwarded-for': '203.0.113.9' },
      }),
    ).toContain(429);
  });

  it('limits the routes of the app, even from this machine', async () => {
    const server = await service();

    expect(await statusesOf(server, { method: 'GET', url: '/health' })).toContain(429);
  });
});
