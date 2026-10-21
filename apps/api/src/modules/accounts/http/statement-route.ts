import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { MoneySchema, moneyBody } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { GetMyStatement } from '../application/get-my-statement.ts';
import type { StatementPosition } from '../application/ports.ts';

/** A cursor that is not one this API could have issued (READ-03). */
class InvalidCursor extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('Statement cursor is malformed');
  }
}

// UTC with microseconds, as the ledger writes it, and the posting's UUID.
const POSITION_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The cursor is opaque to the client: base64url of the position. It is not
 * signed, because the account filter is the server's: a forged cursor only
 * moves inside the reader's own statement (database.md, section 8; READ-03).
 */
function encodeCursor(position: StatementPosition): string {
  return Buffer.from(JSON.stringify({ t: position.createdAt, i: position.postingId })).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): StatementPosition {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursor();
  }
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('t' in decoded) ||
    !('i' in decoded) ||
    typeof decoded.t !== 'string' ||
    typeof decoded.i !== 'string' ||
    !POSITION_TIME.test(decoded.t) ||
    !isRealInstant(decoded.t) ||
    !UUID.test(decoded.i)
  ) {
    throw new InvalidCursor();
  }
  return { createdAt: decoded.t, postingId: decoded.i };
}

/**
 * The format alone lets "2030-13-45" through, and Postgres would refuse it with
 * a 500. A real instant reads back as the same text, up to the milliseconds.
 */
function isRealInstant(time: string): boolean {
  const instant = new Date(time);
  return (
    !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 23) === time.slice(0, 23)
  );
}

// No account (READ-01) and no page size (READ-04): only the cursor and, since
// v1.1.0 (task 4.1), one filter and part of a name, never logged (READ-06).
const StatementQuerySchema = z.strictObject({
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,200}$/)
    .optional(),
  filter: z.enum(['IN', 'OUT', 'PIX', 'RECEIPT']).optional(),
  q: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[^\p{Cc}]*$/u)
    .optional(),
});

const StatementCounterpartySchema = z
  .strictObject({ name: z.string(), documentMasked: z.string().nullable() })
  .meta({ id: 'StatementCounterparty' });

// Only these fields leave the API (READ-02): never an account id or a full document.
const StatementItemSchema = z
  .strictObject({
    id: z.uuid(),
    occurredAt: z.iso.datetime(),
    kind: z.enum(['PIX_SENT', 'PIX_RECEIVED', 'DEMO_FUNDING', 'TOP_UP']),
    direction: z.enum(['IN', 'OUT']),
    amount: MoneySchema,
    counterparty: StatementCounterpartySchema.nullable(),
    // Only on a sent Pix: the link to its receipt (week 6 plan, D3).
    transferId: z.uuid().nullable(),
    // Only on a top-up: the link to its receipt (v1.1.0 plan, task 5).
    topUpId: z.uuid().nullable(),
  })
  .meta({ id: 'StatementItem' });

const StatementSchema = z
  .strictObject({ items: z.array(StatementItemSchema), nextCursor: z.string().nullable() })
  .meta({ id: 'Statement' });

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
      return {
        items: page.items.map((item) => ({
          ...item,
          occurredAt: item.occurredAt.toISOString(),
          amount: moneyBody(item.amount),
        })),
        nextCursor: page.next === null ? null : encodeCursor(page.next),
      };
    },
  );
  return Promise.resolve();
};
