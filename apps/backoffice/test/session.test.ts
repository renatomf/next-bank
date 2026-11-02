import { describe, expect, it } from 'vitest';
import { clearedSessionCookie, SESSION_COOKIE, sessionCookie } from '../lib/session';

// The staff's session in the browser (v1.3.0 plan, task 2; D1, STF-04,
// STF-06): only the API's opaque token, in a cookie no script reads, sent
// only over HTTPS and never on a request another site starts, ending with
// the API's session.
const EXPIRES = new Date('2026-11-02T20:00:00.000Z');

describe('the session cookie', () => {
  it('carries the token as the API issued it, closed to scripts and other sites', () => {
    expect(sessionCookie('opaque-token', EXPIRES)).toEqual({
      name: SESSION_COOKIE,
      value: 'opaque-token',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: EXPIRES,
    });
  });

  it('is cleared at once, with the same flags', () => {
    expect(clearedSessionCookie()).toEqual({
      name: SESSION_COOKIE,
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      expires: new Date(0),
    });
  });
});
