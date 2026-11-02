import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '../lib/session';
import { proxy } from '../proxy';

// What runs before every page of the backoffice (v1.3.0 plan, task 2;
// STF-05, STF-06): a fresh nonce and its CSP on every response, and the
// login for anyone without a session. The API still checks the session on
// every call; this only spares a page that would answer 401.
const request = (path: string, token?: string) =>
  new NextRequest(`https://backoffice.example.test${path}`, {
    headers: token === undefined ? {} : { cookie: `${SESSION_COOKIE}=${token}` },
  });

const nonceOf = (policy: string | null) => /'nonce-([^']+)'/.exec(policy ?? '')?.[1];

describe('proxy', () => {
  it('sends anyone without a session to the login', () => {
    const response = proxy(request('/'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://backoffice.example.test/login');
  });

  it('lets the login through without a session', () => {
    const response = proxy(request('/login'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('content-security-policy')).toContain("'nonce-");
  });

  it('lets a session through, with a CSP whose nonce the page receives', () => {
    const response = proxy(request('/', 'opaque-token'));

    const policy = response.headers.get('content-security-policy');
    expect(response.headers.get('location')).toBeNull();
    expect(nonceOf(policy)).toBeDefined();
    // Next.js hands the request headers it was told to override to the page.
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(policy));
  });

  it('draws a new nonce for each response', () => {
    const first = proxy(request('/login')).headers.get('content-security-policy');
    const second = proxy(request('/login')).headers.get('content-security-policy');

    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });
});
