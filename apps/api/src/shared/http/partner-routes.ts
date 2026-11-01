import type { FastifyRequest } from 'fastify';

/**
 * The routes a partner calls, not the app: the SPI's webhook and the mounted
 * simulator. Only they continue a trace from outside (EXT-10), and only
 * their calls from inside the service skip the global rate limit (C7).
 */
export function isPartnerRoute(route: string): boolean {
  return route === '/v1/spi/webhooks' || route.startsWith('/simulator/');
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * A call one part of the service makes to another (v1.2.0 plan, task 9, C7;
 * F-44): the API calling the mounted simulator, the simulator posting its
 * webhooks. It comes straight from this machine, with no proxy hop: every
 * request from outside comes through the deploy's proxy, from another
 * address and with X-Forwarded-For, and keeps the limit (API-02).
 */
export function isCallInsideTheService(request: FastifyRequest): boolean {
  const route = request.routeOptions.url;
  return (
    route !== undefined &&
    isPartnerRoute(route) &&
    LOOPBACK.has(request.socket.remoteAddress ?? '') &&
    request.headers['x-forwarded-for'] === undefined
  );
}
