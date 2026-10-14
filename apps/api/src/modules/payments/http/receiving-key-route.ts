import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { GetReceivingKey } from '../application/get-receiving-key.ts';

// Only what the "Receber" screen needs (READ-02): no key id, account id or date.
const PixReceivingKeySchema = z
  .strictObject({ key: z.uuid({ version: 'v4' }), keyMasked: z.string() })
  .meta({ id: 'PixReceivingKey' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const receivingKeyRoutes: FastifyPluginAsyncZod<{ getReceivingKey: GetReceivingKey }> = (
  app,
  { getReceivingKey },
) => {
  // POST because the first call creates the key; repeating it is safe, as it
  // always answers the same key (v1.1.0 plan, task 3).
  app.post(
    '/v1/me/pix/receiving-key',
    {
      schema: {
        operationId: 'getReceivingKey',
        security: [{ bearerAuth: [] }],
        response: { 200: PixReceivingKeySchema, 401: problem },
      },
    },
    // No body, like the other bodyless commands: the account comes only from the token (PIX-01).
    async (request) => {
      const { userId } = callerOf(request);
      return getReceivingKey.execute({ customerId: userId });
    },
  );
  return Promise.resolve();
};
