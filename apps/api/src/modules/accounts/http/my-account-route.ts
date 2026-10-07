import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MoneySchema, moneyBody } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { GetMyAccount } from '../application/get-my-account.ts';

// Only these fields leave the API (READ-02): no account id, holder or posted
// balance. The full number is the customer's own; the app masks it on screen.
const MyAccountSchema = z
  .strictObject({
    branch: z.string(),
    number: z.string(),
    status: z.enum(['ACTIVE', 'BLOCKED', 'CLOSED']),
    availableBalance: MoneySchema,
  })
  .meta({ id: 'MyAccount' });

// No parameters at all: the account always comes from the token (READ-01, READ-05).
const NoQuerySchema = z.strictObject({});

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const myAccountRoutes: FastifyPluginAsyncZod<{ getMyAccount: GetMyAccount }> = (
  app,
  { getMyAccount },
) => {
  app.get(
    '/v1/me/account',
    {
      schema: {
        operationId: 'getMyAccount',
        security: [{ bearerAuth: [] }],
        querystring: NoQuerySchema,
        response: { 200: MyAccountSchema, 401: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      const account = await getMyAccount.execute(userId);
      return { ...account, availableBalance: moneyBody(account.availableBalance) };
    },
  );
  return Promise.resolve();
};
