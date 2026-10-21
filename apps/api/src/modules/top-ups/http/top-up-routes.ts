import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Money } from '../../../shared/domain/money.ts';
import { MoneySchema, moneyBody } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import { callerOf } from '../../identity/index.ts';
import type { CreateTopUp } from '../application/create-top-up.ts';
import type { GetTopUp } from '../application/get-top-up.ts';
import { TOP_UP_AMOUNTS, TOP_UP_OPERATORS } from '../domain/operator.ts';

// Every financial command carries an Idempotency-Key (ADR 0007).
const IdempotencyHeadersSchema = z.object({ 'idempotency-key': z.uuid() });

const TopUpOperatorSchema = z
  .strictObject({ id: z.string(), name: z.string(), initials: z.string() })
  .meta({ id: 'TopUpOperator' });

const TopUpOperatorListSchema = z
  .strictObject({
    operators: z.array(TopUpOperatorSchema.extend({ amounts: z.array(MoneySchema) })),
  })
  .meta({ id: 'TopUpOperatorList' });

// The payer never comes from the body; unknown fields are refused. The number,
// the operator and the amount are the domain's to judge (InvalidPhoneNumber,
// UnknownTopUpOperator, InvalidTopUpAmount): here only their size is bounded.
const CreateTopUpRequestSchema = z
  .strictObject({
    operatorId: z.string().min(1).max(32),
    phoneNumber: z.string().min(1).max(20),
    amount: MoneySchema,
    // Exactly 4 digits: a malformed PIN is refused here and never counts as an attempt.
    pin: z.string().regex(/^\d{4}$/),
  })
  .meta({ id: 'CreateTopUpRequest' });

// Only these fields leave the API (READ-02): no account id, never the full number.
const TopUpSchema = z
  .strictObject({
    id: z.uuid(),
    operator: TopUpOperatorSchema,
    phoneMasked: z.string(),
    amount: MoneySchema,
    status: z.enum(['COMPLETED']),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'TopUp' });

// A top-up by its UUIDv7: unguessable, and found only with its owner (READ-01).
const TopUpParamsSchema = z.strictObject({ topUpId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

const OPERATOR_LIST = {
  operators: TOP_UP_OPERATORS.map(({ id, name, initials }) => ({
    id,
    name,
    initials,
    amounts: TOP_UP_AMOUNTS.map(moneyBody),
  })),
};

export const topUpRoutes: FastifyPluginAsyncZod<{
  createTopUp: CreateTopUp;
  getTopUp: GetTopUp;
}> = (app, { createTopUp, getTopUp }) => {
  app.get(
    '/v1/top-ups/operators',
    {
      schema: {
        operationId: 'getTopUpOperators',
        security: [{ bearerAuth: [] }],
        response: { 200: TopUpOperatorListSchema, 401: problem },
      },
    },
    () => Promise.resolve(OPERATOR_LIST),
  );

  app.get(
    '/v1/top-ups/:topUpId',
    {
      schema: {
        operationId: 'getTopUp',
        security: [{ bearerAuth: [] }],
        params: TopUpParamsSchema,
        response: { 200: TopUpSchema, 401: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { userId } = callerOf(request);
      return getTopUp.execute(userId, request.params.topUpId);
    },
  );

  app.post(
    '/v1/top-ups',
    {
      // Moving money: a token of an ended session is refused (AUTH-04).
      config: { activeSession: true },
      schema: {
        operationId: 'createTopUp',
        security: [{ bearerAuth: [] }],
        headers: IdempotencyHeadersSchema,
        body: CreateTopUpRequestSchema,
        response: {
          201: TopUpSchema,
          401: problem,
          404: problem,
          409: problem,
          422: problem,
          423: problem,
        },
      },
    },
    async (request, reply) => {
      const { userId } = callerOf(request);
      const { operatorId, phoneNumber, amount, pin } = request.body;
      const result = await createTopUp.execute({
        userId,
        idempotencyKey: request.headers['idempotency-key'],
        operatorId,
        phoneNumber,
        amount: Money.of(BigInt(amount.amount)),
        pin,
        requestId: request.id,
      });
      return reply.status(201).send(result);
    },
  );
  return Promise.resolve();
};
