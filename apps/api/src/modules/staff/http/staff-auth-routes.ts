import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { StaffLogin } from '../application/staff-login.ts';
import type { StaffLogout } from '../application/staff-logout.ts';
import { STAFF_ROLES } from '../domain/permissions.ts';
import { staffCallerOf } from './staff-authentication.ts';

// Only bounds the input, as the customers' login does: the answer never
// hints at which factor was wrong (STF-01).
const StaffLoginRequestSchema = z
  .strictObject({
    email: z.email().max(254),
    // Bounds the verification cost (AUTH-08).
    password: z.string().min(1).max(256),
    mfaCode: z.string().regex(/^\d{6}$/),
  })
  .meta({ id: 'StaffLoginRequest' });

const StaffMemberSchema = z
  .strictObject({ name: z.string(), role: z.enum(STAFF_ROLES) })
  .meta({ id: 'StaffMember' });

const StaffSessionSchema = z
  .strictObject({ token: z.string(), expiresAt: z.iso.datetime(), member: StaffMemberSchema })
  .meta({ id: 'StaffSession' });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** The staff's sign in and out (v1.3.0 plan, task 1), under /admin/v1. */
export const staffAuthRoutes: FastifyPluginAsyncZod<{
  login: StaffLogin;
  logout: StaffLogout;
}> = (app, { login, logout }) => {
  app.post(
    '/auth/login',
    {
      config: { staffLogin: true },
      schema: {
        operationId: 'staffLogin',
        body: StaffLoginRequestSchema,
        response: { 200: StaffSessionSchema, 401: problem, 422: problem, 429: problem },
      },
    },
    async (request) => {
      const result = await login.execute({ ...request.body, requestId: request.id });
      return { ...result, expiresAt: result.expiresAt.toISOString() };
    },
  );

  app.post(
    '/auth/logout',
    {
      config: { permission: 'staff.self' },
      schema: {
        operationId: 'staffLogout',
        response: { 204: z.null().describe('Session ended'), 401: problem },
      },
    },
    async (request, reply) => {
      const caller = staffCallerOf(request);
      await logout.execute({
        memberId: caller.memberId,
        sessionId: caller.sessionId,
        requestId: request.id,
      });
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      config: { permission: 'staff.self' },
      schema: { operationId: 'staffMe', response: { 200: StaffMemberSchema, 401: problem } },
    },
    (request) => {
      const { name, role } = staffCallerOf(request);
      return Promise.resolve({ name, role });
    },
  );
  return Promise.resolve();
};
