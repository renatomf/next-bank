import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { mountSimulator } from '../src/mount-simulator.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { AURORA_KEY, participantKey } from './simulator.ts';

// The simulator mounted in the API's service under /simulator (v1.2.0 plan,
// D2, P2): its routes skip the API's bearer token but still ask the
// participant's key (EXT-09), and the key looked up in the DICT never
// reaches the API's log (API-04).
const logs = captureLogs();
let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: logs.stream,
    security: testSecurity(),
  });
  const databaseUrl = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  await mountSimulator(app, { databaseUrl, participantKey, faults: undefined });
});

afterAll(async () => {
  await app.close();
});

const dictLookup = (headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url: `/simulator/dict/keys/${AURORA_KEY}`, headers });

describe('the simulator mounted in the API', () => {
  it('answers its health check with no key and no token', async () => {
    const response = await app.inject({ method: 'GET', url: '/simulator/health' });

    expect(response.statusCode).toBe(200);
  });

  it("asks the participant's key, not the API's bearer token (EXT-09)", async () => {
    const response = await dictLookup();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: 'Unauthenticated' });
    expect(response.headers['www-authenticate']).toBeUndefined();
  });

  it('serves the participant that shows the key', async () => {
    const response = await dictLookup({ 'x-participant-key': participantKey });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ bank: { name: 'Banco Aurora' } });
  });

  it('leaves the API routes behind the bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/account',
      headers: { 'x-participant-key': participantKey },
    });

    expect(response.statusCode).toBe(401);
  });

  it('never logs the key looked up in the DICT', async () => {
    await dictLookup({ 'x-participant-key': participantKey });

    expect(logs.raw()).toContain('/simulator/dict/keys/[REDACTED]');
    expect(logs.raw()).not.toContain('clara.aurora');
    expect(logs.raw()).not.toContain(participantKey);
  });
});
