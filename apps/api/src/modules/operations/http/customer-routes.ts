import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MoneySchema, moneyBody } from '../../../shared/http/money.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import {
  decodeCursor,
  StatementCursorSchema,
  StatementSchema,
  statementBody,
} from '../../accounts/index.ts';
import { staffCallerOf } from '../../staff/index.ts';
import type { GetCustomer } from '../application/get-customer.ts';
import type { GetCustomerStatement } from '../application/get-customer-statement.ts';
import type { StaffReader } from '../application/ports.ts';
import type { SearchCustomers } from '../application/search-customers.ts';

// The term goes in the body, never in a URL (C2, READ-06); its kind is the domain's.
const CustomerSearchRequestSchema = z
  .strictObject({
    query: z
      .string()
      .min(3)
      .max(120)
      .regex(/^[^\p{Cc}]*$/u),
  })
  .meta({ id: 'CustomerSearchRequest' });

const CustomerAccountSchema = z
  .strictObject({
    branch: z.string(),
    number: z.string(),
    status: z.enum(['ACTIVE', 'BLOCKED', 'CLOSED']),
  })
  .meta({ id: 'CustomerAccount' });

// Only these fields leave the API (READ-02): the CPF and the e-mail masked (STF-07).
const customerFields = {
  id: z.uuid(),
  name: z.string(),
  cpfMasked: z.string(),
  emailMasked: z.string(),
  status: z.enum(['ACTIVE', 'LOCKED']),
};

const CustomerSummarySchema = z
  .strictObject({ ...customerFields, account: CustomerAccountSchema })
  .meta({ id: 'CustomerSummary' });

const CustomerSearchSchema = z
  .strictObject({ customers: z.array(CustomerSummarySchema), truncated: z.boolean() })
  .meta({ id: 'CustomerSearch' });

const CustomerCardSchema = z
  .strictObject({
    ...customerFields,
    account: CustomerAccountSchema.extend({ openedAt: z.iso.datetime() }),
    balance: MoneySchema,
  })
  .meta({ id: 'CustomerCard' });

const CustomerParamsSchema = z.strictObject({ customerId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** Who reads: the session's member, never what the request says (STF-02, STF-11). */
function readerOf(request: FastifyRequest): StaffReader {
  const caller = staffCallerOf(request);
  return { memberId: caller.memberId, isDemo: caller.isDemo, requestId: request.id };
}

/** The customers for the staff (v1.3.0 plan, task 3), under /admin/v1. */
export const customerRoutes: FastifyPluginAsyncZod<{
  searchCustomers: SearchCustomers;
  getCustomer: GetCustomer;
  getCustomerStatement: GetCustomerStatement;
}> = (app, { searchCustomers, getCustomer, getCustomerStatement }) => {
  app.post(
    '/customers/search',
    {
      config: { permission: 'customers.read' },
      schema: {
        operationId: 'searchCustomers',
        body: CustomerSearchRequestSchema,
        response: { 200: CustomerSearchSchema, 401: problem, 403: problem, 422: problem },
      },
    },
    (request) => searchCustomers.execute(readerOf(request), request.body.query),
  );

  app.get(
    '/customers/:customerId',
    {
      config: { permission: 'customers.read' },
      schema: {
        operationId: 'getCustomer',
        params: CustomerParamsSchema,
        response: {
          200: CustomerCardSchema,
          401: problem,
          403: problem,
          404: problem,
          422: problem,
        },
      },
    },
    async (request) => {
      const card = await getCustomer.execute(readerOf(request), request.params.customerId);
      return {
        ...card,
        account: { ...card.account, openedAt: card.account.openedAt.toISOString() },
        balance: moneyBody(card.balance),
      };
    },
  );

  app.get(
    '/customers/:customerId/statement',
    {
      config: { permission: 'customers.read' },
      schema: {
        operationId: 'getCustomerStatement',
        params: CustomerParamsSchema,
        querystring: z.strictObject({ cursor: StatementCursorSchema.optional() }),
        response: { 200: StatementSchema, 401: problem, 403: problem, 404: problem, 422: problem },
      },
    },
    async (request) => {
      const { cursor } = request.query;
      const page = await getCustomerStatement.execute(
        readerOf(request),
        request.params.customerId,
        cursor === undefined ? null : decodeCursor(cursor),
      );
      return statementBody(page);
    },
  );
  return Promise.resolve();
};
