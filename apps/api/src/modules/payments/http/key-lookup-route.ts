import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { LookupPixKey } from '../application/lookup-pix-key.ts';

const KEY_TYPES = ['CPF', 'EMAIL', 'PHONE', 'RANDOM'] as const;

// The key value travels in the body: never in a URL, a log line or a cache (D2).
// 77 characters fit the longest key type (e-mail); the format is the domain's rule.
const PixKeyLookupRequestSchema = z
  .strictObject({ type: z.enum(KEY_TYPES), value: z.string().min(1).max(77) })
  .meta({ id: 'PixKeyLookupRequest' });

// Only these fields leave the API (READ-02): no account id, never the full CPF (D6).
const PixKeyLookupSchema = z
  .strictObject({
    keyType: z.enum(KEY_TYPES),
    keyMasked: z.string(),
    payeeName: z.string(),
    payeeDocumentMasked: z.string(),
  })
  .meta({ id: 'PixKeyLookup' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const keyLookupRoutes: FastifyPluginAsyncZod<{ lookupPixKey: LookupPixKey }> = (
  app,
  { lookupPixKey },
) => {
  app.post(
    '/v1/pix/key-lookups',
    {
      schema: {
        operationId: 'lookupPixKey',
        security: [{ bearerAuth: [] }],
        body: PixKeyLookupRequestSchema,
        response: {
          200: PixKeyLookupSchema,
          401: problem,
          404: problem,
          422: problem,
          429: problem,
        },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      return lookupPixKey.execute({ customerId: userId, ...request.body });
    },
  );
  return Promise.resolve();
};
