import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { captureLogs, testDatabaseUrl } from './helpers.ts';

// Dados fictícios: nenhum valor real.
const SECRETS = {
  password: 'senha-ficticia-123',
  pin: '9876',
  cpf: 'cpf-ficticio-000',
  pixKey: 'ana@example.com',
  accessToken: 'access-token-ficticio',
  refreshToken: 'refresh-token-ficticio',
  token: 'token-ficticio',
};

describe('logs', () => {
  let app: FastifyInstance;
  let logs: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logs = captureLogs();
    app = buildApp({ pool: createPool(testDatabaseUrl()), logStream: logs.stream });
    app.post('/test/log', (request) => {
      request.log.info({ ...SECRETS, payload: SECRETS }, 'evento com dados sensíveis');
      return { ok: true };
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('redige dados pessoais e segredos (API-04)', async () => {
    await app.inject({
      method: 'POST',
      url: '/test/log',
      headers: { authorization: 'Bearer token-do-header-ficticio' },
      payload: {},
    });

    const output = logs.raw();
    expect(output).toMatch(/evento com dados sensíveis/);
    for (const value of [...Object.values(SECRETS), 'token-do-header-ficticio']) {
      expect(output).not.toContain(value);
    }
    expect(output).toContain('[REDACTED]');
  });

  it('mantém uma linha JSON por evento mesmo com quebra de linha no valor (API-10)', async () => {
    app.get('/test/newline', (request) => {
      request.log.info({ note: 'linha 1\n{"forjado":true}' }, 'tentativa de injeção');
      return { ok: true };
    });

    await app.inject({ method: 'GET', url: '/test/newline' });

    const lines = logs.lines();
    expect(lines.some((line) => 'forjado' in line)).toBe(false);
    expect(lines.find((line) => line.msg === 'tentativa de injeção')?.note).toBe(
      'linha 1\n{"forjado":true}',
    );
  });
});
