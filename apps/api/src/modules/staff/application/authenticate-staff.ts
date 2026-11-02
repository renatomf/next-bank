import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import { StaffSessionExpired, Unauthenticated } from '../domain/errors.ts';
import type { StaffRole } from '../domain/permissions.ts';
import { StaffSession } from '../domain/staff-session.ts';
import type { SessionTokens, StaffRepositoriesFactory } from './ports.ts';

/** Who calls a staff route: read from the database on every request (STF-02). */
export interface StaffCaller {
  memberId: string;
  sessionId: string;
  name: string;
  role: StaffRole;
  /** A member of the public demo, who reads only demo customers (B5, STF-11). */
  isDemo: boolean;
}

export interface AuthenticateStaffDependencies {
  unitOfWork: UnitOfWork;
  repositories: StaffRepositoriesFactory;
  clock: Clock;
  tokens: SessionTokens;
}

/**
 * The session behind a staff token, on every request (v1.3.0 plan, task 1;
 * STF-06): it must be usable and its member active, and each use keeps it
 * alive. The role comes from the database, never from the client.
 */
export class AuthenticateStaff {
  readonly #deps: AuthenticateStaffDependencies;

  constructor(deps: AuthenticateStaffDependencies) {
    this.#deps = deps;
  }

  async execute(token: string): Promise<StaffCaller> {
    const hash = this.#deps.tokens.hash(token);
    if (hash === null) throw new Unauthenticated();
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      const found = await repositories.sessions.findByTokenHash(hash);
      if (found === null) throw new Unauthenticated();
      if (found.member.status !== 'ACTIVE') throw new StaffSessionExpired();
      const session = StaffSession.restore(found.session);
      session.touch(now);
      await repositories.sessions.update(session.state);
      return {
        memberId: found.member.id,
        sessionId: found.session.id,
        name: found.member.name,
        role: found.member.role,
        isDemo: found.member.isDemo,
      };
    });
  }
}
