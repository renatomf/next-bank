import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { captureLogs, testDatabaseUrl } from './helpers.ts';

describe('GET /health', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('responde 200 quando o banco está acessível', async () => {
    app = buildApp({ pool: createPool(testDatabaseUrl()), logStream: captureLogs().stream });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('responde 503 sem detalhes internos quando o banco está fora', async () => {
    const logs = captureLogs();
    app = buildApp({
      pool: createPool('postgres://nextbank_app:x@127.0.0.1:1/nextbank'),
      logStream: logs.stream,
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
    // O detalhe fica só no log interno.
    expect(logs.raw()).toMatch(/ECONNREFUSED/);
  });
});
