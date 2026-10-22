import { describe, expect, it } from 'vitest';
import {
  scrubBreadcrumb,
  scrubEvent,
} from '../../../src/shared/infrastructure/sentry-error-reporter.ts';

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

  // MOB-02, v1.1.0 plan task 5: the number of a top-up never reaches Sentry.
  it('redacts a phone number by its key and by its shape', () => {
    const event = scrubEvent({
      message: 'top-up to (11) 90000-0001 failed',
      exception: { values: [{ type: 'Error', value: 'number 11 90000-0001 refused' }] },
      extra: { input: { phoneNumber: '11900000001', operatorId: 'pulso-celular' } },
    });

    expect(event.message).toBe('top-up to [PHONE] failed');
    expect(event.exception.values[0]?.value).toBe('number [PHONE] refused');
    expect(event.extra).toEqual({
      input: { phoneNumber: '[REDACTED]', operatorId: 'pulso-celular' },
    });
  });

  // Security review of v1.2.0 task 3: the DICT carries the Pix key in its
  // path (D2, API-04), and an e-mail or a %2B-encoded phone has no shape the
  // masks above know. A second layer: any DICT path leaves without its key.
  it.each([
    ['an e-mail', 'http://127.0.0.1:3000/simulator/dict/keys/clara.aurora%40example.com'],
    ['a phone', 'http://127.0.0.1:3000/simulator/dict/keys/%2B5511900009001'],
  ])('redacts %s in the path of a DICT lookup', (_case, url) => {
    const event = scrubEvent({
      request: { url, method: 'GET' },
      breadcrumbs: [{ category: 'http', data: { url, status_code: 500 } }],
    });

    expect(event.request.url).toBe('http://127.0.0.1:3000/simulator/dict/keys/[REDACTED]');
    expect(event.breadcrumbs[0]?.data.url).toBe(
      'http://127.0.0.1:3000/simulator/dict/keys/[REDACTED]',
    );
  });
});

describe('scrubBreadcrumb', () => {
  // The first layer: a call the API makes to a partner (the DICT, the SPI)
  // may carry personal data in its URL, so none is kept as a breadcrumb.
  it('keeps no breadcrumb of an outgoing HTTP call', () => {
    expect(
      scrubBreadcrumb({
        category: 'http',
        type: 'http',
        data: { url: 'http://127.0.0.1:3000/simulator/dict/keys/clara.aurora%40example.com' },
      }),
    ).toBeNull();
  });

  it('keeps any other breadcrumb, scrubbed', () => {
    expect(
      scrubBreadcrumb({ category: 'console', message: 'lookup of 529.982.247-25 failed' }),
    ).toEqual({ category: 'console', message: 'lookup of [CPF] failed' });
  });
});
