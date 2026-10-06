import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../src/app.ts';
import {
  AlreadyRegistered,
  InvalidCpf,
  InvalidPin,
  PinLocked,
  PinResetRequired,
  SessionExpired,
  WeakPassword,
} from '../src/modules/identity/domain/errors.ts';
import { DomainError } from '../src/shared/domain/domain-error.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';

// Error responses follow the catalog (domain-model.md, section 9): RFC 9457
// with the error name in `code`, and never internal detail (API-03).
class NotInCatalog extends DomainError {
  readonly code = 'NotInCatalog';
  constructor() {
    super('a domain error nobody mapped');
  }
}

describe('error responses', () => {
  let app: FastifyInstance;
  let logs: ReturnType<typeof captureLogs>;

  beforeEach(() => {
    logs = captureLogs();
    app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: logs.stream,
      security: testSecurity(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function throwing(error: Error): void {
    app.get('/test/fail', { config: { public: true } }, () => {
      throw error;
    });
  }

  it.each([
    [new InvalidCpf(), 422],
    [new WeakPassword(), 422],
    [new InvalidPin(), 422],
    [new AlreadyRegistered(), 409],
    [new SessionExpired(), 401],
    [new PinLocked(new Date('2026-10-06T12:30:00Z')), 423],
    [new PinResetRequired(), 423],
  ])('answers %s with its catalog status and code', async (error, status) => {
    throwing(error);

    const response = await app.inject({ method: 'GET', url: '/test/fail' });

    expect(response.statusCode).toBe(status);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: expect.any(String) as string,
      status,
      code: error.code,
    });
  });

  it('never exposes the developer message of a domain error', async () => {
    throwing(new AlreadyRegistered());

    const response = await app.inject({ method: 'GET', url: '/test/fail' });

    expect(response.body).not.toMatch(/E-mail or CPF already registered/);
  });

  it('treats a domain error missing from the catalog as a bug: generic 500, logged', async () => {
    throwing(new NotInCatalog());

    const response = await app.inject({ method: 'GET', url: '/test/fail' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(logs.raw()).toMatch(/NotInCatalog/);
  });

  describe('invalid input', () => {
    beforeEach(() => {
      app.withTypeProvider<ZodTypeProvider>().post(
        '/test/strict',
        {
          config: { public: true },
          schema: { body: z.strictObject({ name: z.string().min(2) }) },
        },
        (request) => request.body,
      );
    });

    it('answers 422 InvalidRequest without echoing the input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test/strict',
        payload: { name: 'x' },
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toEqual({
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        code: 'InvalidRequest',
      });
    });

    it('refuses unknown fields (PIX-04)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test/strict',
        payload: { name: 'Maria', payerAccountId: 'someone-else' },
      });

      expect(response.statusCode).toBe(422);
    });
  });
});

describe('caching', () => {
  it('tells every client and proxy not to store any response (F-06)', async () => {
    const app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
    });
    try {
      for (const url of ['/health', '/nao-existe']) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.headers['cache-control']).toBe('no-store');
      }
    } finally {
      await app.close();
    }
  });
});

describe('global rate limit (API-02, F-05)', () => {
  it('covers the real routes', async () => {
    const app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
    });
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.headers['x-ratelimit-limit']).toBe('100');
    } finally {
      await app.close();
    }
  });

  it('answers 429 TooManyAttempts after 100 requests per minute from one IP', async () => {
    const app = buildApp({
      pool: createPool(testDatabaseUrl()),
      logStream: captureLogs().stream,
      security: testSecurity(),
    });
    // Registered as a plugin, like every real route, so it loads after the limiter.
    void app.register((scope, _options, done) => {
      scope.get('/test/ok', { config: { public: true } }, () => ({ ok: true }));
      done();
    });
    try {
      const fromAttacker = {
        method: 'GET',
        url: '/test/ok',
        remoteAddress: '203.0.113.7',
      } as const;
      for (let i = 0; i < 100; i++) {
        expect((await app.inject(fromAttacker)).statusCode).toBe(200);
      }

      const blocked = await app.inject(fromAttacker);
      const otherClient = await app.inject({ ...fromAttacker, remoteAddress: '203.0.113.8' });

      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(blocked.json()).toEqual({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        code: 'TooManyAttempts',
      });
      expect(otherClient.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
