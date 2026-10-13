import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import type { ErrorReporter, ReportedRequest } from '../src/shared/application/ports.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

// Every unexpected error reaches the error tracker; a refusal from the catalog
// is the API working and never does (CLAUDE.md, Observabilidade; week 8
// plan, PR c). The client still gets the generic problem (API-03).
class FakeReporter implements ErrorReporter {
  readonly reports: { error: unknown; request: ReportedRequest }[] = [];

  report(error: unknown, request: ReportedRequest): void {
    this.reports.push({ error, request });
  }
}

describe('error reporting', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  function appWith(reporter: ErrorReporter): FastifyInstance {
    const built = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
      errorReporter: reporter,
    });
    built.get('/boom', { config: { public: true } }, () => {
      throw new Error('something nobody expected');
    });
    return built;
  }

  it('reports an unexpected error once, with the request it broke', async () => {
    const reporter = new FakeReporter();
    app = appWith(reporter);

    const response = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'req-00000001' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(reporter.reports).toHaveLength(1);
    expect(reporter.reports[0]?.request).toEqual({
      requestId: 'req-00000001',
      method: 'GET',
      route: '/boom',
    });
  });

  it('never reports a refusal from the catalog', async () => {
    const reporter = new FakeReporter();
    app = appWith(reporter);

    const refused = await app.inject({ method: 'GET', url: '/v1/me' });

    expect(refused.statusCode).toBe(401);
    expect(reporter.reports).toHaveLength(0);
  });
});
