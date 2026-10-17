import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { GetProfile } from '../application/get-profile.ts';
import { callerOf } from './authentication.ts';

// Only these fields leave the API (READ-02): no e-mail, status or full CPF;
// the CPF only masked, for the Home's Pix box (v1.1.0 plan, task 4.2).
const MeSchema = z
  .strictObject({
    name: z.string(),
    cpfMasked: z.string(),
    hasPin: z.boolean().describe('False while registration still needs the transaction PIN'),
  })
  .meta({ id: 'Me' });

// No parameters at all: the user always comes from the token (READ-01).
const NoQuerySchema = z.strictObject({});

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const meRoutes: FastifyPluginAsyncZod<{ getProfile: GetProfile }> = (
  app,
  { getProfile },
) => {
  app.get(
    '/v1/me',
    {
      schema: {
        operationId: 'getMe',
        security: [{ bearerAuth: [] }],
        querystring: NoQuerySchema,
        response: { 200: MeSchema, 401: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      return getProfile.execute(userId);
    },
  );
  return Promise.resolve();
};
