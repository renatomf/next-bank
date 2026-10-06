import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { Login } from '../application/login.ts';
import { AuthTokensSchema, authTokensBody } from './auth-tokens.ts';

const NO_CONTROL_CHARACTERS = /^[^\p{Cc}]+$/u;

// The schema only bounds the input: the password policy is not checked at login,
// so the answer never hints at which rule an attempt broke.
const LoginRequestSchema = z
  .strictObject({
    email: z.email().max(254),
    // Bounds the verification cost (AUTH-08).
    password: z.string().min(1).max(256),
    deviceLabel: z.string().trim().min(1).max(100).regex(NO_CONTROL_CHARACTERS).optional(),
  })
  .meta({ id: 'LoginRequest' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

// Per IP, across accounts, against credential stuffing (AUTH-01). The per-account
// limit lives in the use case. 10 per minute leaves room for shared IPs.
const LOGINS_PER_IP = { max: 10, timeWindow: '1 minute' };

export const loginRoutes: FastifyPluginAsyncZod<{ login: Login }> = (app, { login }) => {
  app.post(
    '/v1/auth/login',
    {
      config: { public: true, rateLimit: LOGINS_PER_IP },
      schema: {
        operationId: 'login',
        body: LoginRequestSchema,
        response: { 200: AuthTokensSchema, 401: problem, 422: problem, 429: problem },
      },
    },
    async (request) => {
      const result = await login.execute({
        email: request.body.email,
        password: request.body.password,
        deviceLabel: request.body.deviceLabel ?? null,
        requestId: request.id,
      });
      return authTokensBody(result);
    },
  );
  return Promise.resolve();
};
