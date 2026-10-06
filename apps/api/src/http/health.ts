import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, problem } from './problem.ts';

const Problem = z.object({ type: z.literal('about:blank'), title: z.string(), status: z.int() });

export const healthRoutes: FastifyPluginAsyncZod<{ pool: pg.Pool }> = (app, { pool }) => {
  app.get(
    '/health',
    {
      schema: {
        response: { 200: z.object({ status: z.literal('ok') }), 503: Problem },
      },
    },
    async (request, reply) => {
      try {
        await pool.query('SELECT 1');
        return { status: 'ok' as const };
      } catch (err) {
        request.log.error({ err }, 'banco indisponível');
        return reply.status(503).type(PROBLEM_CONTENT_TYPE).send(problem(503));
      }
    },
  );
  return Promise.resolve();
};
