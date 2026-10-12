import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { ListSessions } from '../application/list-sessions.ts';
import type { RevokeSession } from '../application/revoke-session.ts';
import { callerOf } from './authentication.ts';

// Only these fields leave the API (READ-02): no IP, token or user.
const ActiveSessionSchema = z
  .strictObject({
    id: z.uuid(),
    deviceLabel: z.string().nullable().describe('Set by the app at sign-in, e.g. "Android 15"'),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime(),
    current: z.boolean().describe('The session of the token that asked'),
  })
  .meta({ id: 'ActiveSession' });

const SessionListSchema = z
  .strictObject({ items: z.array(ActiveSessionSchema) })
  .meta({ id: 'SessionList' });

// No parameters at all: the user always comes from the token (READ-01).
const NoQuerySchema = z.strictObject({});

const SessionPathSchema = z.strictObject({ sessionId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/**
 * The customer's own sessions (ASVS session). Both routes check that the
 * token's session is still active (AUTH-04): a token from an ended session
 * cannot end the others.
 */
export const meSessionsRoutes: FastifyPluginAsyncZod<{
  listSessions: ListSessions;
  revokeSession: RevokeSession;
}> = (app, { listSessions, revokeSession }) => {
  app.get(
    '/v1/me/sessions',
    {
      config: { activeSession: true },
      schema: {
        operationId: 'listMySessions',
        security: [{ bearerAuth: [] }],
        querystring: NoQuerySchema,
        response: { 200: SessionListSchema, 401: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId, sessionId } = callerOf(request);
      const sessions = await listSessions.execute({ userId, sessionId });
      return {
        items: sessions.map((session) => ({
          ...session,
          createdAt: session.createdAt.toISOString(),
          lastUsedAt: session.lastUsedAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    '/v1/me/sessions/:sessionId/revoke',
    {
      config: { activeSession: true },
      schema: {
        operationId: 'revokeMySession',
        security: [{ bearerAuth: [] }],
        params: SessionPathSchema,
        response: {
          204: z.null().describe('Session ended'),
          401: problem,
          403: problem,
          404: problem,
          422: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId, sessionId } = callerOf(request);
      await revokeSession.execute({
        userId,
        currentSessionId: sessionId,
        sessionId: request.params.sessionId,
        requestId: request.id,
      });
      return reply.status(204).send(null);
    },
  );
  return Promise.resolve();
};
