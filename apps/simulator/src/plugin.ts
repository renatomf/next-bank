import type { FastifyPluginAsync } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import type { Faults } from './base/faults.ts';
import { isParticipantKey, PARTICIPANT_KEY_HEADER } from './base/participant-auth.ts';
import { dictRoutes } from './modules/bacen/dict-routes.ts';
import { settlementRoutes } from './modules/bacen/settlement-routes.ts';
import { spiRoutes } from './modules/bacen/spi-routes.ts';

export interface SimulatorPluginOptions {
  pool: pg.Pool;
  /** The key the participant (the API) presents on every call (EXT-09). */
  participantKey: string;
  faults: Faults;
}

/**
 * The simulator's routes, hooks and error handling as a Fastify plugin, so
 * it runs alone (buildSimulator) or mounted in the API's service under a
 * prefix (v1.2.0 plan, D2). Encapsulated: its validators, error handler and
 * key check reach only its own routes. Every route but the health check asks
 * the participant's key.
 */
export const simulatorPlugin: FastifyPluginAsync<SimulatorPluginOptions> = (app, options) => {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.status(422).send({ code: 'InvalidRequest' });
    }
    // The client's fault, such as a body that is not JSON or one over the
    // limit: its own 4xx, never a server error.
    const status = clientErrorStatus(error);
    if (status !== undefined) {
      return reply.status(status).send({ code: status === 413 ? 'PayloadTooLarge' : 'BadRequest' });
    }
    request.log.error({ err: error }, 'unexpected error');
    return reply.status(500).send({ code: 'InternalError' });
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.url?.endsWith('/health') === true) return;
    if (!isParticipantKey(request.headers[PARTICIPANT_KEY_HEADER], options.participantKey)) {
      return reply.status(401).send({ code: 'Unauthenticated' });
    }
    const latency = options.faults.profile.latencyMs;
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get('/health', () => Promise.resolve({ status: 'ok' }));
  void typed.register(dictRoutes, { pool: options.pool });
  void typed.register(spiRoutes, { pool: options.pool, faults: options.faults });
  void typed.register(settlementRoutes, { pool: options.pool });
  return Promise.resolve();
};

/** A 4xx set by Fastify itself (bad JSON, body too large…); anything else is not. */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}
