import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Clock } from '../../../shared/application/ports.ts';
import type { AccessTokenVerifier } from '../application/ports.ts';
import { SessionExpired, Unauthenticated } from '../domain/errors.ts';

export interface AuthenticatedCaller {
  userId: string;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyContextConfig {
    /** A route is protected unless it declares itself public (deny by default). */
    public?: boolean;
    /** Sensitive operation: the session must still be active in the database (AUTH-04). */
    activeSession?: boolean;
  }
  interface FastifyRequest {
    /** Set only after the access token was verified; null on public routes. */
    auth: AuthenticatedCaller | null;
  }
}

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

/**
 * Deny by default (ASVS access control): every route requires a valid access
 * token unless its config says `public: true`. Forgetting the flag closes a
 * route instead of opening it. Unknown URLs still reach the 404 handler.
 */
export function registerAuthentication(
  app: FastifyInstance,
  verifier: AccessTokenVerifier,
  sessions: { isActive(sessionId: string, now: Date): Promise<boolean> },
  clock: Clock,
): void {
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.url === undefined || request.routeOptions.config.public === true) {
      return;
    }
    // RFC 6750: tells the client which scheme the route expects.
    void reply.header('www-authenticate', 'Bearer');
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (token === undefined) throw new Unauthenticated();
    const now = clock.now();
    const caller = await verifier.verify(token, now);
    if (
      request.routeOptions.config.activeSession === true &&
      !(await sessions.isActive(caller.sessionId, now))
    ) {
      throw new SessionExpired();
    }
    request.auth = caller;
    reply.removeHeader('www-authenticate');
  });
}

/** The verified caller of a protected route. */
export function callerOf(request: FastifyRequest): AuthenticatedCaller {
  // Unreachable on a protected route: the hook above already refused the request.
  if (request.auth === null) throw new Unauthenticated();
  return request.auth;
}
