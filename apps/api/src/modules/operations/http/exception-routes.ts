import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { MoneySchema } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { staffCallerOf } from '../../staff/index.ts';
import type { ExplainException, GetException, ListExceptions } from '../application/exceptions.ts';
import type { ExceptionPosition, StaffReader } from '../application/ports.ts';

const EXCEPTION_KINDS = [
  'MISSING_HERE',
  'MISSING_AT_SPI',
  'AMOUNT_MISMATCH',
  'STATUS_MISMATCH',
  'STALE_PROCESSING',
  'CLEARING_MISMATCH',
] as const;

const PersonSchema = z.strictObject({ id: z.uuid(), name: z.string() });

const ExceptionSchema = z
  .strictObject({
    id: z.uuid(),
    runDate: z.iso.date(),
    kind: z.enum(EXCEPTION_KINDS),
    endToEndId: z.string().nullable(),
    // The SPI's side and next bank's; only the amounts that differ.
    expected: MoneySchema.nullable(),
    actual: MoneySchema.nullable(),
    detectedAt: z.iso.datetime(),
    status: z.enum(['OPEN', 'RESOLVED']),
    pix: z
      .strictObject({
        id: z.uuid(),
        amount: MoneySchema,
        status: z.string(),
        customer: PersonSchema,
      })
      .nullable(),
    pendingRequestId: z.uuid().nullable(),
    resolution: z
      .strictObject({
        outcome: z.enum(['SETTLED', 'REFUNDED', 'EXPLAINED']),
        resolvedBy: PersonSchema,
        resolvedAt: z.iso.datetime(),
        explanation: z.string().nullable(),
        approvalRequestId: z.uuid().nullable(),
      })
      .nullable(),
  })
  .meta({ id: 'ReconciliationException' });

const ExceptionsPageSchema = z
  .strictObject({ items: z.array(ExceptionSchema), nextCursor: z.string().nullable() })
  .meta({ id: 'ReconciliationExceptionsPage' });

const IdParamsSchema = z.strictObject({ exceptionId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** A cursor that is not one this API could have issued. */
class InvalidCursor extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('Exceptions cursor is malformed');
  }
}

const POSITION = z.strictObject({ t: z.iso.datetime(), i: z.uuid() });

function encodeCursor(position: ExceptionPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.detectedAt.toISOString(), i: position.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): ExceptionPosition {
  try {
    const { t, i } = POSITION.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return { detectedAt: new Date(t), id: i };
  } catch {
    throw new InvalidCursor();
  }
}

/** Who acts: the session's member, never what the request says (STF-02, STF-11). */
function actorOf(request: FastifyRequest): StaffReader {
  const caller = staffCallerOf(request);
  return { memberId: caller.memberId, isDemo: caller.isDemo, requestId: request.id };
}

/**
 * The reconciliation's exceptions (v1.3.0 plan, task 6): the queue, one
 * exception, and the analyst's explanation. Settling or refunding a Pix
 * left waiting is a request, in requestRoutes.
 */
export const exceptionRoutes: FastifyPluginAsyncZod<{
  listExceptions: ListExceptions;
  getException: GetException;
  explainException: ExplainException;
}> = (app, deps) => {
  app.get(
    '/exceptions',
    {
      config: { permission: 'exceptions.read' },
      schema: {
        operationId: 'listExceptions',
        querystring: z.strictObject({
          status: z.enum(['OPEN', 'ALL']).default('OPEN'),
          cursor: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,200}$/)
            .optional(),
        }),
        response: { 200: ExceptionsPageSchema, 401: problem, 403: problem, 422: problem },
      },
    },
    async (request) => {
      const { status, cursor } = request.query;
      const page = await deps.listExceptions.execute(actorOf(request), {
        status,
        after: cursor === undefined ? null : decodeCursor(cursor),
      });
      return { items: page.items, nextCursor: page.next && encodeCursor(page.next) };
    },
  );

  app.get(
    '/exceptions/:exceptionId',
    {
      config: { permission: 'exceptions.read' },
      schema: {
        operationId: 'getException',
        params: IdParamsSchema,
        response: { 200: ExceptionSchema, 401: problem, 403: problem, 404: problem, 422: problem },
      },
    },
    (request) => deps.getException.execute(actorOf(request), request.params.exceptionId),
  );

  app.post(
    '/exceptions/:exceptionId/explain',
    {
      config: { permission: 'exceptions.explain' },
      schema: {
        operationId: 'explainException',
        // Drawn when the backoffice renders the form (task 4, K6; ADR 0007).
        headers: z.object({ 'idempotency-key': z.uuid() }),
        params: IdParamsSchema,
        body: z.strictObject({
          explanation: z
            .string()
            .min(10)
            .max(500)
            .regex(/^[^\p{Cc}]*$/u),
        }),
        response: {
          200: ExceptionSchema,
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    (request) =>
      deps.explainException.execute(actorOf(request), {
        exceptionId: request.params.exceptionId,
        explanation: request.body.explanation,
        idempotencyKey: request.headers['idempotency-key'],
      }),
  );
  return Promise.resolve();
};
