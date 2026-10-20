import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

// Fictitious data only: no real values.
const SECRETS = {
  password: 'fake-password',
  pin: '9876',
  cpf: 'fake-cpf',
  pixKey: 'fake-pix-key',
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
  token: 'fake-token',
  // The PIN and password changes (week 7; F-25).
  currentPassword: 'fake-current-password',
  newPassword: 'fake-new-password',
  newPin: '4682',
  // Personal data never goes to logs either (database.md, section 2; F-13).
  email: 'fake-person@example.test',
  name: 'Fake Person Name',
};

describe('logs', () => {
  let app: FastifyInstance;
  let logs: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logs = captureLogs();
    app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: logs.stream,
      security: testSecurity(),
    });
    app.post('/test/log', { config: { public: true } }, (request) => {
      request.log.info({ ...SECRETS, payload: SECRETS }, 'event with sensitive data');
      return { ok: true };
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('redacts personal data and secrets (API-04)', async () => {
    await app.inject({
      method: 'POST',
      url: '/test/log',
      headers: { authorization: 'Bearer fake-header-token' },
      payload: {},
    });

    const output = logs.raw();
    expect(output).toMatch(/event with sensitive data/);
    for (const value of [...Object.values(SECRETS), 'fake-header-token']) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain('[REDACTED]');
  });

  it('keeps one JSON line per event even with a newline in a value (API-10)', async () => {
    app.get('/test/newline', { config: { public: true } }, (request) => {
      request.log.info({ note: 'line 1\n{"forged":true}' }, 'injection attempt');
      return { ok: true };
    });

    await app.inject({ method: 'GET', url: '/test/newline' });

    const lines = logs.lines();
    expect(lines.some((line) => 'forged' in line)).toBe(false);
    expect(lines.find((line) => line.msg === 'injection attempt')?.note).toBe(
      'line 1\n{"forged":true}',
    );
  });

  // READ-06 (v1.1.0 plan, task 4.1): a query string can carry a searched
  // name or a cursor; the request log keeps only the path.
  it('logs the path of a request without its query string (READ-06)', async () => {
    app.get('/test/query', { config: { public: true } }, () => ({ ok: true }));

    await app.inject({ method: 'GET', url: '/test/query?q=Fake%20Searched%20Name&cursor=abc' });

    const incoming = logs.lines().find((line) => line.msg === 'incoming request');
    expect(incoming?.req).toMatchObject({ method: 'GET', url: '/test/query' });
    expect(logs.raw()).not.toContain('Fake');
    expect(logs.raw()).not.toContain('cursor');
  });
});
