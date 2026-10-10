import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { ChangePassword } from '../application/change-password.ts';
import { callerOf } from './authentication.ts';

// Bounds only, as in the login: the policy is the domain's (AUTH-07, AUTH-08).
const ChangePasswordRequestSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(1).max(256),
  })
  .meta({ id: 'ChangePasswordRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const mePasswordRoutes: FastifyPluginAsyncZod<{ changePassword: ChangePassword }> = (
  app,
  { changePassword },
) => {
  app.post(
    '/v1/me/password/change',
    {
      // Sensitive: a token of an ended session is refused even within its 15 minutes.
      config: { activeSession: true },
      schema: {
        operationId: 'changePassword',
        security: [{ bearerAuth: [] }],
        body: ChangePasswordRequestSchema,
        response: {
          204: z.null().describe('Password changed; every other session ended'),
          401: problem,
          422: problem,
          429: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId, sessionId } = callerOf(request);
      await changePassword.execute({
        userId,
        sessionId,
        currentPassword: request.body.currentPassword,
        newPassword: request.body.newPassword,
        requestId: request.id,
      });
      return reply.status(204).send(null);
    },
  );
  return Promise.resolve();
};
