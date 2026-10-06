import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/db.ts';
import { captureLogs, testDatabaseUrl } from './helpers.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('segurança HTTP', () => {
  let app: FastifyInstance;
  let logs: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logs = captureLogs();
    app = buildApp({ pool: createPool(testDatabaseUrl()), logStream: logs.stream });
    // Rotas só de teste, para provocar os cenários.
    app.post('/test/echo', (request) => request.body);
    app.get('/test/boom', () => {
      throw new Error('duplicate key value violates unique constraint "users_cpf_key"');
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('recusa corpo acima de 16 KB com 413 (API-02)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      payload: { data: 'x'.repeat(17 * 1024) },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Payload Too Large',
      status: 413,
    });
  });

  it('aceita corpo dentro do limite', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      payload: { data: 'x'.repeat(1024) },
    });
    expect(response.statusCode).toBe(200);
  });

  it('responde erro inesperado com RFC 9457 genérico, sem stack nem SQL (API-03)', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(response.body).not.toMatch(/duplicate key|users_cpf_key|at .*\.ts/);
    // O detalhe fica só no log interno.
    expect(logs.raw()).toMatch(/users_cpf_key/);
  });

  it('responde rota inexistente com 404 no mesmo formato', async () => {
    const response = await app.inject({ method: 'GET', url: '/nao-existe' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ type: 'about:blank', title: 'Not Found', status: 404 });
  });

  it('envia headers de segurança', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  describe('x-request-id', () => {
    it('propaga o id recebido para a resposta e para o log', async () => {
      const id = '0190f0f0-0000-7000-8000-000000000abc';
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': id },
      });

      expect(response.headers['x-request-id']).toBe(id);
      expect(logs.lines().some((line) => line.reqId === id)).toBe(true);
    });

    it('gera um id quando não recebe', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.headers['x-request-id']).toMatch(UUID);
    });

    it('troca um id malformado por um gerado (API-10)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': 'a'.repeat(200) },
      });
      expect(response.headers['x-request-id']).toMatch(UUID);
    });
  });
});
