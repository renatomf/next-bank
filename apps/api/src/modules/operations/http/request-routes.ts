import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { MoneySchema } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { staffCallerOf } from '../../staff/index.ts';
import type { BlockAccount } from '../application/block-account.ts';
import type { CancelRequest } from '../application/cancel-request.ts';
import type { DecideRequest } from '../application/decide-request.ts';
import type { RequestResolution } from '../application/exceptions.ts';
import type { GetRequest, ListRequests } from '../application/list-requests.ts';
import type { RequestPosition, StaffReader } from '../application/ports.ts';
import type { RequestReversal } from '../application/request-reversal.ts';
import type { RequestUnblock } from '../application/request-unblock.ts';
import { REASONS, REQUEST_KINDS } from '../domain/approval-request.ts';
import { RESOLUTIONS } from '../domain/reconciliation-exception.ts';

// Every command of the staff carries an Idempotency-Key, which the backoffice
// draws when it renders the form (task 4, K6; ADR 0007).
const IdempotencyHeadersSchema = z.object({ 'idempotency-key': z.uuid() });

const NoteSchema = z
  .string()
  .max(500)
  .regex(/^[^\p{Cc}]*$/u)
  .nullable()
  .optional();

const PersonSchema = z.strictObject({ id: z.uuid(), name: z.string() }).meta({ id: 'Person' });

const RequestSchema = z
  .strictObject({
    id: z.uuid(),
    kind: z.enum(REQUEST_KINDS),
    status: z.enum(['PENDING', 'EXPIRED', 'APPROVED', 'REJECTED', 'CANCELLED']),
    customer: PersonSchema,
    // The Pix a reversal reverses, with its own amount (PIX-14); none for an unblock.
    transfer: z
      .strictObject({ id: z.uuid(), amount: MoneySchema, payeeName: z.string() })
      .nullable(),
    // The exception a resolution resolves, and how (task 6); none for the others.
    exception: z.strictObject({ id: z.uuid(), resolution: z.enum(RESOLUTIONS) }).nullable(),
    reason: z.enum(REASONS),
    note: z.string().nullable(),
    requestedBy: PersonSchema,
    requestedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    decision: z
      .strictObject({
        decision: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
        decidedBy: PersonSchema,
        decidedAt: z.iso.datetime(),
        note: z.string().nullable(),
      })
      .nullable(),
  })
  .meta({ id: 'ApprovalRequest' });

const RequestsPageSchema = z
  .strictObject({ items: z.array(RequestSchema), nextCursor: z.string().nullable() })
  .meta({ id: 'ApprovalRequestsPage' });

const IdParamsSchema = z.strictObject({ requestId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** A cursor that is not one this API could have issued. */
class InvalidCursor extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('Requests cursor is malformed');
  }
}

const POSITION = z.strictObject({ t: z.iso.datetime(), i: z.uuid() });

function encodeCursor(position: RequestPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.requestedAt.toISOString(), i: position.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): RequestPosition {
  try {
    const { t, i } = POSITION.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return { requestedAt: new Date(t), id: i };
  } catch {
    throw new InvalidCursor();
  }
}

/** Who acts: the session's member, never what the request says (STF-02, STF-11). */
function actorOf(request: FastifyRequest): StaffReader {
  const caller = staffCallerOf(request);
  return { memberId: caller.memberId, isDemo: caller.isDemo, requestId: request.id };
}

/** Blocking accounts and the requests that need two people (v1.3.0 plan, task 4). */
export const requestRoutes: FastifyPluginAsyncZod<{
  blockAccount: BlockAccount;
  requestUnblock: RequestUnblock;
  requestReversal: RequestReversal;
  requestResolution: RequestResolution;
  decideRequest: DecideRequest;
  cancelRequest: CancelRequest;
  listRequests: ListRequests;
  getRequest: GetRequest;
}> = (app, deps) => {
  app.post(
    '/customers/:customerId/block',
    {
      config: { permission: 'accounts.block' },
      schema: {
        operationId: 'blockAccount',
        headers: IdempotencyHeadersSchema,
        params: z.strictObject({ customerId: z.uuid() }),
        body: z.strictObject({ reason: z.enum(REASONS) }),
        response: {
          204: z.null().describe('Account blocked; the customer is out'),
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request, reply) => {
      await deps.blockAccount.execute(actorOf(request), {
        customerId: request.params.customerId,
        reason: request.body.reason,
        idempotencyKey: request.headers['idempotency-key'],
      });
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/requests',
    {
      config: { permission: 'requests.create' },
      schema: {
        operationId: 'createRequest',
        headers: IdempotencyHeadersSchema,
        // An unblock names the customer; a reversal names the Pix, never an amount
        // (PIX-14); a resolution names the exception and how (task 6).
        body: z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('UNBLOCK_ACCOUNT'),
            customerId: z.uuid(),
            reason: z.enum(REASONS),
            note: NoteSchema,
          }),
          z.strictObject({
            kind: z.literal('REVERSE_PIX'),
            transferId: z.uuid(),
            reason: z.enum(REASONS),
            note: NoteSchema,
          }),
          z.strictObject({
            kind: z.literal('RESOLVE_EXCEPTION'),
            exceptionId: z.uuid(),
            resolution: z.enum(RESOLUTIONS),
            reason: z.enum(REASONS),
            note: NoteSchema,
          }),
        ]),
        response: {
          201: RequestSchema,
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request, reply) => {
      const { body } = request;
      const common = {
        reason: body.reason,
        note: body.note ?? null,
        idempotencyKey: request.headers['idempotency-key'],
      };
      const actor = actorOf(request);
      switch (body.kind) {
        case 'REVERSE_PIX':
          return reply
            .status(201)
            .send(
              await deps.requestReversal.execute(actor, { ...common, transferId: body.transferId }),
            );
        case 'RESOLVE_EXCEPTION':
          return reply.status(201).send(
            await deps.requestResolution.execute(actor, {
              ...common,
              exceptionId: body.exceptionId,
              resolution: body.resolution,
            }),
          );
        case 'UNBLOCK_ACCOUNT':
          return reply
            .status(201)
            .send(
              await deps.requestUnblock.execute(actor, { ...common, customerId: body.customerId }),
            );
      }
    },
  );

  app.get(
    '/requests',
    {
      config: { permission: 'requests.read' },
      schema: {
        operationId: 'listRequests',
        querystring: z.strictObject({
          status: z.enum(['PENDING', 'ALL']).default('PENDING'),
          // Only what the member asked (home plan, H1); the session says who.
          mine: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
          cursor: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,200}$/)
            .optional(),
        }),
        response: { 200: RequestsPageSchema, 401: problem, 403: problem, 422: problem },
      },
    },
    async (request) => {
      const { status, mine, cursor } = request.query;
      const page = await deps.listRequests.execute(actorOf(request), {
        status,
        mine,
        after: cursor === undefined ? null : decodeCursor(cursor),
      });
      return { items: page.items, nextCursor: page.next && encodeCursor(page.next) };
    },
  );

  app.get(
    '/requests/:requestId',
    {
      config: { permission: 'requests.read' },
      schema: {
        operationId: 'getRequest',
        params: IdParamsSchema,
        response: { 200: RequestSchema, 401: problem, 403: problem, 404: problem, 422: problem },
      },
    },
    (request) => deps.getRequest.execute(actorOf(request), request.params.requestId),
  );

  for (const decision of ['APPROVE', 'REJECT'] as const) {
    app.post(
      `/requests/:requestId/${decision.toLowerCase()}`,
      {
        config: { permission: 'requests.decide' },
        schema: {
          operationId: decision === 'APPROVE' ? 'approveRequest' : 'rejectRequest',
          headers: IdempotencyHeadersSchema,
          params: IdParamsSchema,
          body: z.strictObject({ note: NoteSchema }),
          response: {
            200: RequestSchema,
            401: problem,
            403: problem,
            404: problem,
            409: problem,
            422: problem,
          },
        },
      },
      (request) =>
        deps.decideRequest.execute(actorOf(request), {
          requestId: request.params.requestId,
          decision,
          note: request.body.note ?? null,
          idempotencyKey: request.headers['idempotency-key'],
        }),
    );
  }

  app.post(
    '/requests/:requestId/cancel',
    {
      // Only the requester cancels, and only operators ask (K3).
      config: { permission: 'requests.create' },
      schema: {
        operationId: 'cancelRequest',
        headers: IdempotencyHeadersSchema,
        params: IdParamsSchema,
        body: z.strictObject({}),
        response: {
          200: RequestSchema,
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    (request) =>
      deps.cancelRequest.execute(actorOf(request), {
        requestId: request.params.requestId,
        idempotencyKey: request.headers['idempotency-key'],
      }),
  );
  return Promise.resolve();
};
