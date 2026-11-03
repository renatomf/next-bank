import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { assertAllowed, staffCallerOf } from '../../staff/index.ts';
import type { AuditQuery, ReadAuditTrail } from '../application/audit-trail.ts';
import type { AuditPosition } from '../application/ports.ts';

const AuditEntrySchema = z
  .strictObject({
    id: z.uuid(),
    occurredAt: z.iso.datetime(),
    actor: z.strictObject({
      type: z.enum(['USER', 'SYSTEM', 'STAFF']),
      id: z.uuid().nullable(),
      // Only the staff is named; a customer shows by id (H4).
      name: z.string().nullable(),
    }),
    action: z.string(),
    subject: z.strictObject({ type: z.string(), id: z.uuid() }),
    requestId: z.string().nullable(),
    // Allowed fields only, checked when recorded (API-04).
    metadata: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'AuditEntry' });

const AuditPageSchema = z
  .strictObject({ items: z.array(AuditEntrySchema), nextCursor: z.string().nullable() })
  .meta({ id: 'AuditPage' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** A trail asked for with no filter, or with more than one (STF-16, H2). */
class InvalidAuditQuery extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('The audit trail is read by exactly one filter');
  }
}

const POSITION = z.strictObject({ t: z.iso.datetime(), i: z.uuid() });

function encodeCursor(position: AuditPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.occurredAt.toISOString(), i: position.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): AuditPosition {
  try {
    const { t, i } = POSITION.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return { occurredAt: new Date(t), id: i };
  } catch {
    throw new InvalidAuditQuery();
  }
}

function queryOf(filters: {
  customerId?: string | undefined;
  memberId?: string | undefined;
  requestId?: string | undefined;
}): AuditQuery {
  const { customerId, memberId, requestId } = filters;
  const given = [customerId, memberId, requestId].filter((value) => value !== undefined);
  if (given.length !== 1) throw new InvalidAuditQuery();
  if (customerId !== undefined) return { by: 'CUSTOMER', customerId };
  if (memberId !== undefined) return { by: 'MEMBER', memberId };
  return { by: 'REQUEST', requestId: requestId ?? '' };
}

/**
 * The audit trail (v1.3.0 plan, task 8), for the analyst and the admin (H1).
 * A customer's trail also asks for customers.read, which the admin lacks
 * (C1): the role decides, never the client (STF-02).
 */
export const auditRoutes: FastifyPluginAsyncZod<{ readAuditTrail: ReadAuditTrail }> = (
  app,
  deps,
) => {
  app.get(
    '/audit',
    {
      config: { permission: 'audit.read' },
      schema: {
        operationId: 'readAuditTrail',
        querystring: z.strictObject({
          customerId: z.uuid().optional(),
          memberId: z.uuid().optional(),
          requestId: z.uuid().optional(),
          cursor: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,200}$/)
            .optional(),
        }),
        response: { 200: AuditPageSchema, 401: problem, 403: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const caller = staffCallerOf(request);
      const { cursor, ...filters } = request.query;
      const query = queryOf(filters);
      if (query.by === 'CUSTOMER') assertAllowed(caller.role, 'customers.read');
      const page = await deps.readAuditTrail.execute(
        { memberId: caller.memberId, isDemo: caller.isDemo, requestId: request.id },
        query,
        cursor === undefined ? null : decodeCursor(cursor),
      );
      return { items: page.items, nextCursor: page.next && encodeCursor(page.next) };
    },
  );
  return Promise.resolve();
};
