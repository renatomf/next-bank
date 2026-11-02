import { describe, expect, it } from 'vitest';
import { adminApi, LoginRefused, SessionEnded } from '../lib/api';

// The backoffice's client of the API's /admin routes (v1.3.0 plan, task 2;
// B2, STF-08): only the server calls it, always with the backoffice's key
// and a request id of its own, never cached (a member's answer never serves
// another), and a session the API refuses ends here too.
interface Call {
  url: string;
  method: string;
  headers: Headers;
  body: string;
  cache: RequestCache | undefined;
}

function recordingFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetch = async (input: Request) => {
    calls.push({
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: await input.text(),
      cache: input.cache,
    });
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetch };
}

const api = (fetch: (input: Request) => Promise<Response>, token?: string) =>
  adminApi({ baseUrl: 'https://api.example.test', apiKey: 'backoffice-key', token, fetch });

describe('adminApi', () => {
  it('signs in with the backoffice key, a request id and no cache', async () => {
    const { calls, fetch } = recordingFetch(200, {
      token: 'opaque-token',
      expiresAt: '2026-11-02T20:00:00.000Z',
      member: { name: 'Lia Operadora', role: 'OPERATOR' },
    });

    const session = await api(fetch).login({
      email: 'lia@example.com',
      password: 'a password',
      mfaCode: '123456',
    });

    expect(session).toEqual({
      token: 'opaque-token',
      expiresAt: new Date('2026-11-02T20:00:00.000Z'),
    });
    const [call] = calls;
    expect(call?.url).toBe('https://api.example.test/admin/v1/auth/login');
    expect(call?.method).toBe('POST');
    expect(call?.headers.get('x-backoffice-key')).toBe('backoffice-key');
    expect(call?.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.headers.get('authorization')).toBeNull();
    expect(call?.cache).toBe('no-store');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({
      email: 'lia@example.com',
      password: 'a password',
      mfaCode: '123456',
    });
  });

  it.each([
    [401, 'InvalidCredentials'],
    [429, 'TooManyAttempts'],
  ])('tells why a login was refused (%i)', async (status, code) => {
    const { fetch } = recordingFetch(status, { code });

    await expect(
      api(fetch).login({ email: 'lia@example.com', password: 'x', mfaCode: '000000' }),
    ).rejects.toEqual(new LoginRefused(code));
  });

  it('reads the member with the session token', async () => {
    const { calls, fetch } = recordingFetch(200, { name: 'Lia Operadora', role: 'ANALYST' });

    await expect(api(fetch, 'opaque-token').me()).resolves.toEqual({
      name: 'Lia Operadora',
      role: 'ANALYST',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer opaque-token');
    expect(calls[0]?.headers.get('x-backoffice-key')).toBe('backoffice-key');
  });

  it('ends the session the API refuses', async () => {
    const { fetch } = recordingFetch(401, { code: 'StaffSessionExpired' });

    await expect(api(fetch, 'opaque-token').me()).rejects.toBeInstanceOf(SessionEnded);
  });

  it('signs out with the session token', async () => {
    const { calls, fetch } = recordingFetch(204, null);

    await api(fetch, 'opaque-token').logout();

    expect(calls[0]?.url).toBe('https://api.example.test/admin/v1/auth/logout');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer opaque-token');
  });
});
