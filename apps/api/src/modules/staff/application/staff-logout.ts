import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { StaffSession } from '../domain/staff-session.ts';
import type { StaffRepositoriesFactory } from './ports.ts';

export interface StaffLogoutDependencies {
  unitOfWork: UnitOfWork;
  repositories: StaffRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
}

/** Ends the caller's own session at once, and records it (STF-06). */
export class StaffLogout {
  readonly #deps: StaffLogoutDependencies;

  constructor(deps: StaffLogoutDependencies) {
    this.#deps = deps;
  }

  async execute(input: {
    memberId: string;
    sessionId: string;
    requestId: string | null;
  }): Promise<void> {
    const now = this.#deps.clock.now();
    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      const state = await repositories.sessions.lock(input.sessionId);
      // The caller's own session, just authenticated: it cannot be missing.
      if (state === null) return;
      const session = StaffSession.restore(state);
      session.revoke(now);
      await repositories.sessions.update(session.state);
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'STAFF',
        actorId: input.memberId,
        action: 'STAFF_SESSION_REVOKED',
        subjectType: 'STAFF_SESSION',
        subjectId: input.sessionId,
        requestId: input.requestId,
        metadata: {},
      });
    });
  }
}
