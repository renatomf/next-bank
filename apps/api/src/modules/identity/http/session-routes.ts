import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { Logout } from '../application/logout.ts';
import type { RefreshSession } from '../application/refresh-session.ts';
import { callerOf } from './authentication.ts';
import { AuthTokensSchema, authTokensBody } from './auth-tokens.ts';

const RefreshRequestSchema = z
  .strictObject({
    // A real token has 43 characters; the bound keeps anything else cheap to refuse.
    refreshToken: z.string().min(1).max(64),
  })
  .meta({ id: 'RefreshRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const sessionRoutes: FastifyPluginAsyncZod<{
  refreshSession: RefreshSession;
  logout: Logout;
}> = (app, { refreshSession, logout }) => {
  app.post(
    '/v1/auth/refresh',
    {
      config: { public: true },
      schema: {
        operationId: 'refreshSession',
        body: RefreshRequestSchema,
        response: { 200: AuthTokensSchema, 401: problem, 422: problem },
      },
    },
    async (request) => {
      const result = await refreshSession.execute({
        refreshToken: request.body.refreshToken,
        requestId: request.id,
      });
      return authTokensBody(result);
    },
  );

  app.post(
    '/v1/auth/logout',
    {
      schema: {
        operationId: 'logout',
        security: [{ bearerAuth: [] }],
        response: { 204: z.null().describe('Session ended'), 401: problem },
      },
    },
    async (request, reply) => {
      const caller = callerOf(request);
      await logout.execute({ ...caller, requestId: request.id });
      return reply.status(204).send(null);
    },
  );
  return Promise.resolve();
};
