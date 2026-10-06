import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { CreatePin } from '../application/create-pin.ts';
import { callerOf } from './authentication.ts';

// Only a bound: the format (4 digits, no trivial pattern) is the domain's rule.
const CreatePinRequestSchema = z
  .strictObject({ pin: z.string().max(8) })
  .meta({ id: 'CreatePinRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const pinRoutes: FastifyPluginAsyncZod<{ createPin: CreatePin }> = (app, { createPin }) => {
  app.post(
    '/v1/me/pin',
    {
      // Sensitive: a token of an ended session is refused even within its 15 minutes.
      config: { activeSession: true },
      schema: {
        operationId: 'createPin',
        security: [{ bearerAuth: [] }],
        body: CreatePinRequestSchema,
        response: {
          204: z.null().describe('PIN created'),
          401: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId } = callerOf(request);
      await createPin.execute({ userId, pin: request.body.pin, requestId: request.id });
      return reply.status(204).send(null);
    },
  );
  return Promise.resolve();
};
