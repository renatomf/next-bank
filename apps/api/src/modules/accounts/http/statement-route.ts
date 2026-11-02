import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { GetMyStatement } from '../application/get-my-statement.ts';
import {
  decodeCursor,
  StatementCursorSchema,
  StatementSchema,
  statementBody,
} from './statement-body.ts';

// No account (READ-01) and no page size (READ-04): only the cursor and, since
// v1.1.0 (task 4.1), one filter and part of a name, never logged (READ-06).
const StatementQuerySchema = z.strictObject({
  cursor: StatementCursorSchema.optional(),
  filter: z.enum(['IN', 'OUT', 'PIX', 'RECEIPT']).optional(),
  q: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[^\p{Cc}]*$/u)
    .optional(),
});

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const statementRoutes: FastifyPluginAsyncZod<{ getMyStatement: GetMyStatement }> = (
  app,
  { getMyStatement },
) => {
  app.get(
    '/v1/me/statement',
    {
      schema: {
        operationId: 'getMyStatement',
        security: [{ bearerAuth: [] }],
        querystring: StatementQuerySchema,
        response: { 200: StatementSchema, 401: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      const { cursor, filter, q } = request.query;
      const page = await getMyStatement.execute(
        userId,
        cursor === undefined ? null : decodeCursor(cursor),
        { kind: filter ?? null, search: q ?? null },
      );
      return statementBody(page);
    },
  );
  return Promise.resolve();
};
