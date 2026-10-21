import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema, problem } from './problem.ts';

const HealthSchema = z
  .object({
    status: z.literal('ok'),
    release: z.string().optional().describe('The commit running, when the host tells it'),
  })
  .meta({ id: 'Health' });

const ClientIpSchema = z
  .object({
    ip: z.string().describe('The address the API gives the caller, the one its limits count'),
  })
  .meta({ id: 'ClientIp' });

export const healthRoutes: FastifyPluginAsyncZod<{ pool: pg.Pool; release?: string }> = (
  app,
  { pool, release },
) => {
  app.get(
    '/health',
    {
      // Probed by the platform without credentials.
      config: { public: true },
      schema: {
        operationId: 'getHealth',
        response: {
          200: HealthSchema,
          503: { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } },
        },
      },
    },
    async (request, reply) => {
      try {
        await pool.query('SELECT 1');
        return { status: 'ok' as const, ...(release ? { release } : {}) };
      } catch (err) {
        request.log.error({ err }, 'database unavailable');
        return reply.status(503).type(PROBLEM_CONTENT_TYPE).send(problem(503));
      }
    },
  );

  // API-14 (v1.1.0 plan, task 8): the smoke test after a deploy compares what
  // this says for a plain call and for one with a forged X-Forwarded-For, to
  // catch a TRUST_PROXY that no longer matches the hops in front (F-29). It
  // tells callers only their own address.
  app.get(
    '/health/client-ip',
    {
      config: { public: true },
      schema: {
        operationId: 'getClientIp',
        response: { 200: ClientIpSchema },
      },
    },
    (request) => Promise.resolve({ ip: request.ip }),
  );
  return Promise.resolve();
};
