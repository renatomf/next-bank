import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import { PROBLEM_CONTENT_TYPE, ProblemSchema } from '../../../shared/http/problem.ts';
import type { CreateStaffMember } from '../application/create-staff-member.ts';
import {
  type ChangeStaffRole,
  type DisableStaffMember,
  type ListStaff,
  type StaffActor,
  type StaffPosition,
  viewOf,
} from '../application/manage-staff.ts';
import { STAFF_ROLES } from '../domain/permissions.ts';
import { MANAGED_ROLES } from '../domain/staff-member.ts';
import { staffCallerOf } from './staff-authentication.ts';

const StaffMemberViewSchema = z
  .strictObject({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(STAFF_ROLES),
    status: z.enum(['ACTIVE', 'DISABLED']),
    isDemo: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'StaffMemberView' });

const StaffPageSchema = z
  .strictObject({ items: z.array(StaffMemberViewSchema), nextCursor: z.string().nullable() })
  .meta({ id: 'StaffPage' });

// Shown once, in this answer only (G5, STF-15): no idempotency record keeps it.
const CreatedStaffMemberSchema = z
  .strictObject({
    member: StaffMemberViewSchema,
    credentials: z.strictObject({
      password: z.string(),
      totpSecret: z.string(),
      totpUri: z.string(),
    }),
  })
  .meta({ id: 'CreatedStaffMember' });

const IdParamsSchema = z.strictObject({ memberId: z.uuid() });

const problem = { content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } } };

/** A cursor that is not one this API could have issued. */
class InvalidCursor extends DomainError {
  readonly code = 'InvalidRequest';

  constructor() {
    super('Staff cursor is malformed');
  }
}

const POSITION = z.strictObject({ t: z.iso.datetime(), i: z.uuid() });

function encodeCursor(position: StaffPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.createdAt.toISOString(), i: position.id }),
  ).toString('base64url');
}

function decodeCursor(cursor: string): StaffPosition {
  try {
    const { t, i } = POSITION.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return { createdAt: new Date(t), id: i };
  } catch {
    throw new InvalidCursor();
  }
}

/** The admin acting: the session's member, never what the request says (STF-02). */
function actorOf(request: FastifyRequest): StaffActor {
  return { memberId: staffCallerOf(request).memberId, requestId: request.id };
}

/**
 * The admin's screen of the staff (v1.3.0 plan, task 7), admin only (C1):
 * the list, a new operator or analyst, a role switched, a member disabled.
 * Each command is idempotent by its own state: the e-mail is unique, a role
 * already set changes nothing, and a disabled member stays disabled.
 */
export const staffManagementRoutes: FastifyPluginAsyncZod<{
  createMember: CreateStaffMember;
  listStaff: ListStaff;
  changeStaffRole: ChangeStaffRole;
  disableStaffMember: DisableStaffMember;
}> = (app, deps) => {
  app.get(
    '/staff',
    {
      config: { permission: 'staff.manage' },
      schema: {
        operationId: 'listStaff',
        querystring: z.strictObject({
          cursor: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,200}$/)
            .optional(),
        }),
        response: { 200: StaffPageSchema, 401: problem, 403: problem, 422: problem },
      },
    },
    async (request) => {
      const { cursor } = request.query;
      const page = await deps.listStaff.execute({
        after: cursor === undefined ? null : decodeCursor(cursor),
      });
      return { items: page.items, nextCursor: page.next && encodeCursor(page.next) };
    },
  );

  app.post(
    '/staff',
    {
      config: { permission: 'staff.manage' },
      schema: {
        operationId: 'createStaffMember',
        body: z.strictObject({
          name: z
            .string()
            .min(2)
            .max(80)
            .regex(/^[^\p{Cc}]*$/u),
          email: z.email().max(254),
          role: z.enum(MANAGED_ROLES),
        }),
        response: {
          201: CreatedStaffMemberSchema,
          401: problem,
          403: problem,
          409: problem,
          422: problem,
        },
      },
    },
    async (request, reply) => {
      const created = await deps.createMember.execute({
        ...request.body,
        // The admin's members are never the public demo's (G6).
        isDemo: false,
        author: actorOf(request),
      });
      return reply.status(201).send({
        member: viewOf(created.member),
        credentials: {
          password: created.password,
          totpSecret: created.totpSecret,
          totpUri: created.totpUri,
        },
      });
    },
  );

  app.post(
    '/staff/:memberId/role',
    {
      config: { permission: 'staff.manage' },
      schema: {
        operationId: 'changeStaffRole',
        params: IdParamsSchema,
        body: z.strictObject({ role: z.enum(MANAGED_ROLES) }),
        response: {
          200: StaffMemberViewSchema,
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    (request) =>
      deps.changeStaffRole.execute(actorOf(request), {
        memberId: request.params.memberId,
        role: request.body.role,
      }),
  );

  app.post(
    '/staff/:memberId/disable',
    {
      config: { permission: 'staff.manage' },
      schema: {
        operationId: 'disableStaffMember',
        params: IdParamsSchema,
        body: z.strictObject({}),
        response: {
          200: StaffMemberViewSchema,
          401: problem,
          403: problem,
          404: problem,
          409: problem,
          422: problem,
        },
      },
    },
    (request) =>
      deps.disableStaffMember.execute(actorOf(request), { memberId: request.params.memberId }),
  );
  return Promise.resolve();
};
