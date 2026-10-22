import Fastify, { type FastifyInstance } from 'fastify';
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

export interface SimulatorDependencies {
  pool: pg.Pool;
  /** The key the participant (the API) presents on every call (EXT-09). */
  participantKey: string;
  faults: Faults;
  /** Logs one JSON line per request; off by default (tests). */
  logger?: boolean;
}

/**
 * The simulator of the Bacen and the other partners (v1.2.0 plan, D13): a
 * Fastify app of its own, which the API reaches only over HTTP. Every route
 * but the health check asks the participant's key.
 */
export function buildSimulator(deps: SimulatorDependencies): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 16 * 1024 });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (typeof error === 'object' && error !== null && 'validation' in error) {
      return reply.status(422).send({ code: 'InvalidRequest' });
    }
    request.log.error({ err: error }, 'unexpected error');
    return reply.status(500).send({ code: 'InternalError' });
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    if (!isParticipantKey(request.headers[PARTICIPANT_KEY_HEADER], deps.participantKey)) {
      return reply.status(401).send({ code: 'Unauthenticated' });
    }
    const latency = deps.faults.profile.latencyMs;
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  });

  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get('/health', () => Promise.resolve({ status: 'ok' }));
  void typed.register(dictRoutes, { pool: deps.pool });
  void typed.register(spiRoutes, { pool: deps.pool, faults: deps.faults });
  void typed.register(settlementRoutes, { pool: deps.pool });
  return app;
}
