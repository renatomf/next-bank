import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { StaffCaller } from '../application/authenticate-staff.ts';
import { Unauthenticated } from '../domain/errors.ts';
import { assertAllowed, type Permission } from '../domain/permissions.ts';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** What a staff route requires; a staff route without one never starts (STF-02). */
    permission?: Permission;
    /** The staff's login: the backoffice's key, and no session yet. */
    staffLogin?: boolean;
  }
  interface FastifyRequest {
    /** Set only after the staff session was authenticated; null elsewhere. */
    staff: StaffCaller | null;
  }
}

export const BACKOFFICE_KEY_HEADER = 'x-backoffice-key';

const BEARER = /^Bearer ([A-Za-z0-9_-]+)$/;

/**
 * The door of the staff's routes (v1.3.0 plan, task 1), registered inside
 * their plugin only. Every call must bring the backoffice's own key
 * (STF-08), compared in constant time; then a staff session, authenticated
 * against the database, whose role must grant the route's permission
 * (STF-02). A route of the plugin that declares no permission stops the
 * server from starting: forgetting it closes nothing silently.
 */
export function registerStaffAuthentication(
  scope: FastifyInstance,
  options: { apiKey: string; authenticate: (token: string) => Promise<StaffCaller> },
): void {
  const expectedKey = digest(options.apiKey);
  scope.decorateRequest('staff', null);

  const withoutPermission: string[] = [];
  scope.addHook('onRoute', (route) => {
    // The customers' authentication leaves these routes to this hook.
    route.config = { ...route.config, ownAuthentication: true };
    if (route.config.permission === undefined && route.config.staffLogin !== true) {
      withoutPermission.push(route.url);
    }
  });
  // Refused once every route is known, so the error reaches whoever starts the server.
  scope.addHook('onReady', () => {
    if (withoutPermission.length === 0) return Promise.resolve();
    return Promise.reject(
      new Error(`Staff routes declare no permission (STF-02): ${withoutPermission.join(', ')}`),
    );
  });

  scope.addHook('onRequest', async (request) => {
    const key = request.headers[BACKOFFICE_KEY_HEADER];
    if (typeof key !== 'string' || !timingSafeEqual(digest(key), expectedKey)) {
      throw new Unauthenticated();
    }
    const { config } = request.routeOptions;
    if (config.staffLogin === true) return;
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (token === undefined || config.permission === undefined) throw new Unauthenticated();
    const caller = await options.authenticate(token);
    assertAllowed(caller.role, config.permission);
    request.staff = caller;
  });
}

/** The authenticated staff member of a staff route. */
export function staffCallerOf(request: FastifyRequest): StaffCaller {
  // Unreachable on a staff route: the hook above already refused the request.
  if (request.staff === null) throw new Unauthenticated();
  return request.staff;
}

/** Same length whatever was sent, so the comparison takes the same time. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
