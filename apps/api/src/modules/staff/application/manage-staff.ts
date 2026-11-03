import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import type { StaffRole } from '../domain/permissions.ts';
import { StaffMember, type StaffMemberState, type StaffStatus } from '../domain/staff-member.ts';
import type { StaffRepositories, StaffRepositoriesFactory } from './ports.ts';

/** The admin acting, as its session says (STF-02). */
export interface StaffActor {
  memberId: string;
  requestId: string | null;
}

/** A member as the admin's screen shows it: never its credentials. */
export interface StaffMemberView {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  isDemo: boolean;
  createdAt: string;
}

export interface StaffPosition {
  createdAt: Date;
  id: string;
}

export interface StaffPage {
  items: StaffMemberView[];
  next: StaffPosition | null;
}

export interface ManageStaffDependencies {
  unitOfWork: UnitOfWork;
  repositories: StaffRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
}

const PAGE_SIZE = 20;

export function viewOf(state: StaffMemberState): StaffMemberView {
  return {
    id: state.id,
    name: state.name,
    email: state.email,
    role: state.role,
    status: state.status,
    isDemo: state.isDemo,
    createdAt: state.createdAt.toISOString(),
  };
}

/** The member locked for the change, so two changes of one member run one at a time. */
async function lockedMember(repositories: StaffRepositories, id: string): Promise<StaffMember> {
  const state = await repositories.members.lock(id);
  if (!state) throw new NotFound('StaffMember');
  return StaffMember.restore(state);
}

function staffEvent(
  deps: ManageStaffDependencies,
  actor: StaffActor,
  action: string,
  memberId: string,
  metadata: Record<string, string | number>,
) {
  return {
    id: deps.ids.next(),
    occurredAt: deps.clock.now(),
    actorType: 'STAFF' as const,
    actorId: actor.memberId,
    action,
    subjectType: 'STAFF_MEMBER',
    subjectId: memberId,
    requestId: actor.requestId,
    metadata,
  };
}

/** The staff, newest first, a page at a time (v1.3.0 plan, task 7). */
export class ListStaff {
  readonly #deps: ManageStaffDependencies;

  constructor(deps: ManageStaffDependencies) {
    this.#deps = deps;
  }

  execute(input: { after: StaffPosition | null }): Promise<StaffPage> {
    return this.#deps.unitOfWork.run(async (tx) => {
      const found = await this.#deps.repositories
        .for(tx)
        .members.page({ after: input.after, limit: PAGE_SIZE + 1 });
      const page = found.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      return {
        items: page.map(viewOf),
        next: found.length > PAGE_SIZE && last ? { createdAt: last.createdAt, id: last.id } : null,
      };
    });
  }
}

/**
 * Switches a member between operator and analyst (task 7): never the admin
 * itself, never an admin (G1, STF-14). The role counts on the member's next
 * request (G3); a request already the role changes and audits nothing.
 */
export class ChangeStaffRole {
  readonly #deps: ManageStaffDependencies;

  constructor(deps: ManageStaffDependencies) {
    this.#deps = deps;
  }

  execute(
    actor: StaffActor,
    input: { memberId: string; role: StaffRole },
  ): Promise<StaffMemberView> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      const member = await lockedMember(repositories, input.memberId);
      const from = member.state.role;
      if (member.changeRole(input.role, actor.memberId, now)) {
        await repositories.members.updateAccess(member.state);
        await repositories.audit.record(
          staffEvent(this.#deps, actor, 'STAFF_ROLE_CHANGED', member.state.id, {
            from,
            to: input.role,
          }),
        );
      }
      return viewOf(member.state);
    });
  }
}

/**
 * Disables a member for good (task 7, G4), ending every session it has in
 * the same transaction (STF-06): its next request is refused.
 */
export class DisableStaffMember {
  readonly #deps: ManageStaffDependencies;

  constructor(deps: ManageStaffDependencies) {
    this.#deps = deps;
  }

  execute(actor: StaffActor, input: { memberId: string }): Promise<StaffMemberView> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      const member = await lockedMember(repositories, input.memberId);
      member.disable(actor.memberId, now);
      await repositories.members.updateAccess(member.state);
      const sessionsRevoked = await repositories.sessions.revokeAllOf(member.state.id, now);
      await repositories.audit.record(
        staffEvent(this.#deps, actor, 'STAFF_MEMBER_DISABLED', member.state.id, {
          sessionsRevoked,
        }),
      );
      return viewOf(member.state);
    });
  }
}
