import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { MoneySchema } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { CancelPixSchedule } from '../application/cancel-pix-schedule.ts';
import type { CreatePixSchedule } from '../application/create-pix-schedule.ts';
import type { GetPixSchedules } from '../application/get-pix-schedules.ts';
import type { SchedulePosition } from '../application/ports.ts';
import { PixPayeeBankSchema } from './transfer-routes.ts';

const KEY_TYPES = ['CPF', 'EMAIL', 'PHONE', 'RANDOM'] as const;

// Every financial command carries an Idempotency-Key (ADR 0007).
const IdempotencyHeadersSchema = z.object({ 'idempotency-key': z.uuid() });

// A day, as YYYY-MM-DD; whether it is a real one and when it falls is the domain's.
const DateSchema = z.iso.date();

const FREQUENCIES = ['ONCE', 'MONTHLY'] as const;

// Once, without times, or monthly with them: how many is the domain's to judge
// (InvalidRecurrence). Flat, not a union, so every client reads it plainly.
const ScheduleRecurrenceRequestSchema = z
  .strictObject({ frequency: z.enum(FREQUENCIES), times: z.int().min(1).max(99).optional() })
  .refine((recurrence) => (recurrence.frequency === 'ONCE') === (recurrence.times === undefined))
  .meta({ id: 'ScheduleRecurrenceRequest' });

// Times is 1 for a Pix scheduled once.
const ScheduleRecurrenceSchema = z
  .strictObject({ frequency: z.enum(FREQUENCIES), times: z.int().min(1) })
  .meta({ id: 'ScheduleRecurrence' });

// The payer never comes from the body (PIX-01); unknown fields are refused (PIX-04).
const CreatePixScheduleRequestSchema = z
  .strictObject({
    key: z.strictObject({ type: z.enum(KEY_TYPES), value: z.string().min(1).max(77) }),
    amount: MoneySchema,
    description: z
      .string()
      .max(140)
      // No control characters and no blank padding: it is printed on receipts.
      .regex(/^(?!\s)[^\p{Cc}]*(?<!\s)$/u)
      .optional(),
    firstDate: DateSchema,
    recurrence: ScheduleRecurrenceRequestSchema,
    // Exactly 4 digits: a malformed PIN is refused here and never counts as an attempt.
    pin: z.string().regex(/^\d{4}$/),
  })
  .meta({ id: 'CreatePixScheduleRequest' });

// Only these fields leave the API (READ-02): no account id, never the full key.
const PixScheduleSchema = z
  .strictObject({
    id: z.uuid(),
    status: z.enum(['ACTIVE', 'FINISHED', 'CANCELLED']),
    amount: MoneySchema,
    description: z.string().nullable(),
    payee: z.strictObject({
      name: z.string(),
      documentMasked: z.string(),
      keyType: z.enum(KEY_TYPES),
      keyMasked: z.string(),
      // Only for a payee at another bank.
      bank: PixPayeeBankSchema.optional(),
    }),
    firstDate: DateSchema,
    recurrence: ScheduleRecurrenceSchema,
    nextOccurrenceDate: DateSchema.nullable(),
    lastOccurrenceDate: DateSchema,
    createdAt: z.iso.datetime(),
    cancelledAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PixSchedule' });

const PixScheduleOccurrenceSchema = z
  .strictObject({
    sequence: z.int().min(1),
    date: DateSchema,
    // The Pix that paid it: its receipt is GET /v1/pix/transfers/{transferId}.
    transferId: z.uuid(),
    status: z.enum(['AWAITING_AUTH', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    failureReason: z
      .enum([
        'INSUFFICIENT_FUNDS',
        'LIMIT_EXCEEDED',
        'PAYEE_UNAVAILABLE',
        'ACCOUNT_BLOCKED',
        'PAYEE_BANK_REJECTED',
      ])
      .nullable(),
  })
  .meta({ id: 'PixScheduleOccurrence' });

const PixScheduleDetailSchema = PixScheduleSchema.extend({
  occurrences: z.array(PixScheduleOccurrenceSchema),
}).meta({ id: 'PixScheduleDetail' });

const PixSchedulePageSchema = z
  .strictObject({ items: z.array(PixScheduleSchema), nextCursor: z.string().nullable() })
  .meta({ id: 'PixSchedulePage' });

// No page size (READ-04): only the cursor, opaque to the client.
const ListQuerySchema = z.strictObject({ cursor: z.string().max(200).optional() });

// A schedule by its UUIDv7: unguessable, and found only with its payer (READ-01).
const ScheduleParamsSchema = z.strictObject({ scheduleId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** A cursor that is not one this API could have issued (READ-03). */
class InvalidCursor extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('Schedule cursor is malformed');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Opaque to the client: base64url of the position. Not signed, because the
 * payer filter is the server's: a forged cursor only moves inside the
 * reader's own schedules (READ-03).
 */
function encodeCursor(position: SchedulePosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.createdAt.toISOString(), i: position.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): SchedulePosition {
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
    !UUID.test(decoded.i)
  ) {
    throw new InvalidCursor();
  }
  const createdAt = new Date(decoded.t);
  // A real instant reads back as the same text; anything else would reach Postgres.
  if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== decoded.t) {
    throw new InvalidCursor();
  }
  return { createdAt, id: decoded.i };
}

export const scheduleRoutes: FastifyPluginAsyncZod<{
  createPixSchedule: CreatePixSchedule;
  getPixSchedules: GetPixSchedules;
  cancelPixSchedule: CancelPixSchedule;
}> = (app, { createPixSchedule, getPixSchedules, cancelPixSchedule }) => {
  app.post(
    '/v1/pix/schedules',
    {
      // Authorizing money to move: a token of an ended session is refused (AUTH-04).
      config: { activeSession: true },
      schema: {
        operationId: 'createPixSchedule',
        security: [{ bearerAuth: [] }],
        headers: IdempotencyHeadersSchema,
        body: CreatePixScheduleRequestSchema,
        response: {
          201: PixScheduleSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
          423: problem,
          429: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId, sessionId } = callerOf(request);
      const { key, amount, description, firstDate, recurrence, pin } = request.body;
      const view = await createPixSchedule.execute({
        userId,
        sessionId,
        idempotencyKey: request.headers['idempotency-key'],
        key,
        amountCents: amount.amount,
        description: description ?? null,
        firstDate,
        recurrence:
          recurrence.times === undefined
            ? { frequency: 'ONCE' }
            : { frequency: 'MONTHLY', times: recurrence.times },
        pin,
        requestId: request.id,
      });
      return reply.status(201).send(view);
    },
  );

  app.get(
    '/v1/pix/schedules',
    {
      schema: {
        operationId: 'listPixSchedules',
        security: [{ bearerAuth: [] }],
        querystring: ListQuerySchema,
        response: { 200: PixSchedulePageSchema, 401: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      const { cursor } = request.query;
      const page = await getPixSchedules.list({
        userId,
        after: cursor === undefined ? null : decodeCursor(cursor),
      });
      return { items: page.items, nextCursor: page.next && encodeCursor(page.next) };
    },
  );

  app.get(
    '/v1/pix/schedules/:scheduleId',
    {
      schema: {
        operationId: 'getPixSchedule',
        security: [{ bearerAuth: [] }],
        params: ScheduleParamsSchema,
        response: { 200: PixScheduleDetailSchema, 401: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      return getPixSchedules.get({ userId, scheduleId: request.params.scheduleId });
    },
  );

  app.post(
    '/v1/pix/schedules/:scheduleId/cancel',
    {
      config: { activeSession: true },
      schema: {
        operationId: 'cancelPixSchedule',
        security: [{ bearerAuth: [] }],
        params: ScheduleParamsSchema,
        response: {
          200: PixScheduleSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request) => {
      const { userId, sessionId } = callerOf(request);
      return cancelPixSchedule.execute({
        userId,
        sessionId,
        scheduleId: request.params.scheduleId,
        requestId: request.id,
      });
    },
  );
  return Promise.resolve();
};
