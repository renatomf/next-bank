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
  return Promise.resolve();
};
