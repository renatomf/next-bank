import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

describe('GET /health', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 when the database is reachable', async () => {
    app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  // Week 8 plan, task 3b: the smoke test after a deploy waits for this commit,
  // and the release names the version on errors (CLAUDE.md, Observabilidade).
  it('names the release it runs, when it knows it', async () => {
    app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
      release: '0123abcd',
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.json()).toEqual({ status: 'ok', release: '0123abcd' });
  });

  it('returns 503 without internal details when the database is down', async () => {
    const logs = captureLogs();
    app = buildApp({
      pool: createPool('postgres://nextbank_app:x@127.0.0.1:1/nextbank'),
      logStream: logs.stream,
      security: testSecurity(),
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
    });
    expect(response.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|postgres/i);
    // The detail goes only to the internal log.
    expect(logs.raw()).toMatch(/ECONNREFUSED/);
  });
});
