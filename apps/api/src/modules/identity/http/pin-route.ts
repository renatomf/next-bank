import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { CreatePin } from '../application/create-pin.ts';
import type { VerifyPin } from '../application/verify-pin.ts';
import { callerOf } from './authentication.ts';

// Only a bound: the format (4 digits, no trivial pattern) is the domain's rule.
const CreatePinRequestSchema = z
  .strictObject({ pin: z.string().max(8) })
  .meta({ id: 'CreatePinRequest' });

// Exactly 4 digits: a malformed PIN is refused here and never counts as an attempt.
const VerifyPinRequestSchema = z
  .strictObject({ pin: z.string().regex(/^\d{4}$/) })
  .meta({ id: 'VerifyPinRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const pinRoutes: FastifyPluginAsyncZod<{ createPin: CreatePin; verifyPin: VerifyPin }> = (
  app,
  { createPin, verifyPin },
) => {
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

  // The Unlock screen (F-16): same counter as the Pix (PIX-05).
  app.post(
    '/v1/me/pin/verify',
    {
      config: { activeSession: true },
      schema: {
        operationId: 'verifyPin',
        security: [{ bearerAuth: [] }],
        body: VerifyPinRequestSchema,
        response: {
          204: z.null().describe('PIN verified'),
          401: problem,
          409: problem,
          422: problem,
          423: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId } = callerOf(request);
      await verifyPin.execute({ userId, pin: request.body.pin, requestId: request.id });
      return reply.status(204).send(null);
    },
  );
  return Promise.resolve();
};
