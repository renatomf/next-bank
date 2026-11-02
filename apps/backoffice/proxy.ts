import { type NextRequest, NextResponse } from 'next/server';
import { contentSecurityPolicy } from './lib/csp';
import { SESSION_COOKIE } from './lib/session';

/**
 * Runs before every page of the backoffice (v1.3.0 plan, task 2; STF-05,
 * STF-06): draws a nonce, puts the CSP with it on the response and hands it
 * to the page, which marks its scripts with it; and sends anyone without a
 * session to the login. The session itself is checked by the API on every
 * call: this only spares rendering a page that would answer 401.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = contentSecurityPolicy(nonce, {
    development: process.env.NODE_ENV === 'development',
  });

  if (!request.cookies.has(SESSION_COOKIE) && request.nextUrl.pathname !== '/login') {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    redirect.headers.set('content-security-policy', policy);
    return redirect;
  }

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', policy);
  return response;
}

export const config = {
  // Every page; not the static files Next.js serves with its own hashes.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
