export const SESSION_COOKIE = 'nb_staff';

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: 'strict';
  path: '/';
  expires: Date;
}

/**
 * The staff's session in the browser (v1.3.0 plan, task 2; D1): the API's
 * opaque token as it came, in a cookie no script reads (httpOnly), sent only
 * over HTTPS and never on a request another site starts (SameSite=Strict,
 * STF-04), ending when the API's session does (STF-06). Encrypting it again
 * would change nothing: a stolen cookie works the same either way.
 */
export function sessionCookie(token: string, expiresAt: Date): SessionCookie {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  };
}

/** The cookie that replaces the session at logout or when the API ends it. */
export function clearedSessionCookie(): SessionCookie {
  return sessionCookie('', new Date(0));
}
