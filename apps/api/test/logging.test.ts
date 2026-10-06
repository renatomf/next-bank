import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl } from './helpers.ts';

// Fictitious data only: no real values.
const SECRETS = {
  password: 'fake-password',
  pin: '9876',
  cpf: 'fake-cpf',
  pixKey: 'fake-pix-key',
  accessToken: 'fake-access-token',
  refreshToken: 'fake-refresh-token',
  token: 'fake-token',
};

describe('logs', () => {
  let app: FastifyInstance;
  let logs: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logs = captureLogs();
    app = buildApp({ pool: createPool(testDatabaseUrl()), logStream: logs.stream });
    app.post('/test/log', (request) => {
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
    app.get('/test/newline', (request) => {
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
});
