import { describe, expect, it } from 'vitest';
import { scrubEvent } from '../../../src/shared/infrastructure/sentry-error-reporter.ts';

// What leaves for Sentry carries no personal data nor secrets (CLAUDE.md,
// LGPD; API-04; week 8 plan, PR c): the same keys the logs redact, the whole
// request body, and anything shaped like a CPF.
describe('scrubEvent', () => {
  it('drops the request body, cookies and credentials headers', () => {
    const event = scrubEvent({
      request: {
        url: 'https://api.example/v1/auth/login',
        method: 'POST',
        data: '{"email":"ana@example.com","password":"s3cr3t"}',
        cookies: { session: 'x' },
        headers: { authorization: 'Bearer abc', cookie: 'a=b', 'x-request-id': 'r-1' },
        query_string: 'cursor=abc',
      },
    });

    expect(event.request).toEqual({
      url: 'https://api.example/v1/auth/login',
      method: 'POST',
      headers: { 'x-request-id': 'r-1' },
    });
  });

  // READ-06, as for the request log: a query string can carry a searched name
  // or a statement cursor, which must never reach Sentry either.
  it('keeps the request URL without its query string', () => {
    const event = scrubEvent({
      request: {
        url: 'https://api.example/v1/me/statement?q=Mariana&cursor=abc',
        method: 'GET',
      },
    });

    expect(event.request).toEqual({
      url: 'https://api.example/v1/me/statement',
      method: 'GET',
    });
  });

  it('keeps the URL of an HTTP breadcrumb without its query string', () => {
    const event = scrubEvent({
      breadcrumbs: [
        {
          category: 'http',
          data: { url: '/v1/me/statement?q=Mariana', status_code: 200 },
        },
      ],
    });

    expect(event.breadcrumbs).toEqual([
      { category: 'http', data: { url: '/v1/me/statement', status_code: 200 } },
    ]);
  });

  it('drops the user and redacts sensitive keys at any depth', () => {
    const event = scrubEvent({
      user: { id: 'u-1', email: 'ana@example.com', ip_address: '203.0.113.1' },
      extra: { pin: '2580', nested: { refreshToken: 'r', ok: 'kept' } },
      contexts: { input: { newPassword: 'p', cpf: '52998224725' } },
      breadcrumbs: [{ message: 'login', data: { password: 'p', status: 401 } }],
    });

    expect(event.user).toBeUndefined();
    expect(event.extra).toEqual({
      pin: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', ok: 'kept' },
    });
    expect(event.contexts).toEqual({ input: { newPassword: '[REDACTED]', cpf: '[REDACTED]' } });
    expect(event.breadcrumbs).toEqual([
      { message: 'login', data: { password: '[REDACTED]', status: 401 } },
    ]);
  });

  it('masks anything shaped like a CPF in messages and exceptions', () => {
    const event = scrubEvent({
      message: 'lookup of 529.982.247-25 failed',
      exception: { values: [{ type: 'Error', value: 'cpf 52998224725 is busy' }] },
    });

    expect(event.message).toBe('lookup of [CPF] failed');
    expect(event.exception.values[0]?.value).toBe('cpf [CPF] is busy');
  });
});
