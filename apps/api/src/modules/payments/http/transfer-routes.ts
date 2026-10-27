import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { MoneySchema } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { AuthorizePixTransfer } from '../application/authorize-pix-transfer.ts';
import type { CancelPixTransfer } from '../application/cancel-pix-transfer.ts';
import type { CreatePixTransfer } from '../application/create-pix-transfer.ts';
import type { GetPixTransfer } from '../application/get-pix-transfer.ts';

const KEY_TYPES = ['CPF', 'EMAIL', 'PHONE', 'RANDOM'] as const;

// Every financial command carries an Idempotency-Key (ADR 0007).
const IdempotencyHeadersSchema = z.object({ 'idempotency-key': z.uuid() });

/** The key a Pix or a schedule is sent to: named once, so every client has one type. */
export const PixKeyRequestSchema = z
  .strictObject({ type: z.enum(KEY_TYPES), value: z.string().min(1).max(77) })
  .meta({ id: 'PixKeyRequest' });

// The payer never comes from the body (PIX-01); unknown fields are refused (PIX-04).
// The amount is a safe integer of cents; zero or less is the domain's InvalidAmount.
const CreatePixTransferRequestSchema = z
  .strictObject({
    key: PixKeyRequestSchema,
    amount: MoneySchema,
    description: z
      .string()
      .max(140)
      // No control characters and no blank padding: it is printed on receipts.
      .regex(/^(?!\s)[^\p{Cc}]*(?<!\s)$/u)
      .optional(),
  })
  .meta({ id: 'CreatePixTransferRequest' });

/** The other bank of a payee outside next bank, as the DICT names it (v1.2.0 plan, task 3). */
export const PixPayeeBankSchema = z
  .strictObject({ ispb: z.string(), name: z.string() })
  .meta({ id: 'PixPayeeBank' });

const PixPayeeSchema = z
  .strictObject({
    name: z.string(),
    documentMasked: z.string(),
    keyType: z.enum(KEY_TYPES),
    keyMasked: z.string(),
    // Only for a payee at another bank.
    bank: PixPayeeBankSchema.optional(),
  })
  .meta({ id: 'PixPayee' });

// Only these fields leave the API (READ-02): no account id, never the full CPF.
export const PixTransferSchema = z
  .strictObject({
    id: z.uuid(),
    status: z.enum(['AWAITING_AUTH', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
    amount: MoneySchema,
    description: z.string().nullable(),
    payee: PixPayeeSchema,
    endToEndId: z.string().nullable(),
    failureReason: z
      .enum([
        'INSUFFICIENT_FUNDS',
        'LIMIT_EXCEEDED',
        'PAYEE_UNAVAILABLE',
        'ACCOUNT_BLOCKED',
        'PAYEE_BANK_REJECTED',
      ])
      .nullable(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PixTransfer' });

// Exactly 4 digits: a malformed PIN is refused here and never counts as an attempt.
const AuthorizePixTransferRequestSchema = z
  .strictObject({ pin: z.string().regex(/^\d{4}$/) })
  .meta({ id: 'AuthorizePixTransferRequest' });

// A Pix by its UUIDv7 (D3): unguessable, and found only with its payer (PIX-01).
const TransferParamsSchema = z.strictObject({ transferId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

export const transferRoutes: FastifyPluginAsyncZod<{
  createPixTransfer: CreatePixTransfer;
  authorizePixTransfer: AuthorizePixTransfer;
  getPixTransfer: GetPixTransfer;
  cancelPixTransfer: CancelPixTransfer;
}> = (app, { createPixTransfer, authorizePixTransfer, getPixTransfer, cancelPixTransfer }) => {
  app.get(
    '/v1/pix/transfers/:transferId',
    {
      schema: {
        operationId: 'getPixTransfer',
        security: [{ bearerAuth: [] }],
        params: TransferParamsSchema,
        response: { 200: PixTransferSchema, 401: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      return getPixTransfer.execute({ userId, transferId: request.params.transferId });
    },
  );

  app.post(
    '/v1/pix/transfers/:transferId/authorize',
    {
      // Moving money: a token of an ended session is refused (AUTH-04).
      config: { activeSession: true },
      schema: {
        operationId: 'authorizePixTransfer',
        security: [{ bearerAuth: [] }],
        headers: IdempotencyHeadersSchema,
        params: TransferParamsSchema,
        body: AuthorizePixTransferRequestSchema,
        response: {
          200: PixTransferSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
          423: problem,
        },
      },
    },
    async (request) => {
      const { userId, sessionId } = callerOf(request);
      return authorizePixTransfer.execute({
        userId,
        sessionId,
        transferId: request.params.transferId,
        idempotencyKey: request.headers['idempotency-key'],
        pin: request.body.pin,
        requestId: request.id,
      });
    },
  );

  app.post(
    '/v1/pix/transfers/:transferId/cancel',
    {
      config: { activeSession: true },
      schema: {
        operationId: 'cancelPixTransfer',
        security: [{ bearerAuth: [] }],
        params: TransferParamsSchema,
        response: {
          200: PixTransferSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request) => {
      const { userId, sessionId } = callerOf(request);
      return cancelPixTransfer.execute({
        userId,
        sessionId,
        transferId: request.params.transferId,
        requestId: request.id,
      });
    },
  );

  app.post(
    '/v1/pix/transfers',
    {
      // Moving money: a token of an ended session is refused (AUTH-04).
      config: { activeSession: true },
      schema: {
        operationId: 'createPixTransfer',
        security: [{ bearerAuth: [] }],
        headers: IdempotencyHeadersSchema,
        body: CreatePixTransferRequestSchema,
        response: {
          201: PixTransferSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
          429: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId, sessionId } = callerOf(request);
      const { key, amount, description } = request.body;
      const result = await createPixTransfer.execute({
        userId,
        sessionId,
        idempotencyKey: request.headers['idempotency-key'],
        key,
        amountCents: amount.amount,
        description: description ?? null,
        requestId: request.id,
      });
      return reply.status(201).send(result.body);
    },
  );
  return Promise.resolve();
};
