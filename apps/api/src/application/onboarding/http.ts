import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthTokensSchema, authTokensBody } from '../../modules/identity/index.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../shared/http/problem.ts';
import type { RegisterCustomer } from './register-customer.ts';

// The schema bounds what reaches the use case; the domain decides what is valid
// (CPF check digits, password policy). Unknown fields are refused (PIX-04).
const NO_CONTROL_CHARACTERS = /^[^\p{Cc}]+$/u;

const RegisterRequestSchema = z
  .strictObject({
    // Trimmed before counting, so "  a  " cannot pass here and break the database check.
    name: z.string().trim().min(2).max(120).regex(NO_CONTROL_CHARACTERS),
    email: z.email().max(254),
    // Format and check digits are the domain's job (InvalidCpf).
    cpf: z.string().max(14),
    // Bounds the hashing cost before the domain's 10-128 character rule (AUTH-08).
    password: z.string().min(1).max(256),
    deviceLabel: z.string().trim().min(1).max(100).regex(NO_CONTROL_CHARACTERS).optional(),
  })
  .meta({ id: 'RegisterRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

// Every attempt counts, failed ones included: robots testing data are limited too (AUTH-09).
const REGISTRATIONS_PER_IP = { max: 3, timeWindow: '1 hour' };

export const onboardingRoutes: FastifyPluginAsyncZod<{ registerCustomer: RegisterCustomer }> = (
  app,
  { registerCustomer },
) => {
  app.post(
    '/v1/auth/register',
    {
      config: { rateLimit: REGISTRATIONS_PER_IP },
      schema: {
        operationId: 'registerCustomer',
        body: RegisterRequestSchema,
        response: { 201: AuthTokensSchema, 409: problem, 422: problem, 429: problem },
      },
    },
    async (request, reply) => {
      const result = await registerCustomer.execute({
        ...request.body,
        deviceLabel: request.body.deviceLabel ?? null,
        requestId: request.id,
      });
      return reply.status(201).send(authTokensBody(result));
    },
  );
  return Promise.resolve();
};
