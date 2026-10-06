import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { Session } from '../domain/session.ts';
import type { IdentityRepositoriesFactory } from './ports.ts';

export interface LogoutInput {
  /** From the verified access token, never from the request body. */
  userId: string;
  sessionId: string;
  requestId: string | null;
}

export interface LogoutDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Ends the caller's session (AUTH-06): its refresh token stops working at once;
 * the access token expires within 15 minutes (accepted in ADR 0004). Idempotent.
 */
export class Logout {
  readonly #deps: LogoutDependencies;

  constructor(deps: LogoutDependencies) {
    this.#deps = deps;
  }

  async execute(input: LogoutInput): Promise<void> {
    const now = this.#deps.clock.now();
    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      // Locked like a refresh, so the two cannot interleave.
      const state = await repositories.sessions.lockById(input.sessionId);
      // Missing, someone else's or already ended: nothing to do (idempotent).
      if (state?.userId !== input.userId || state.revokedAt !== null) return;

      const session = Session.restore(state);
      session.revoke('LOGOUT', now);
      await repositories.sessions.update(session.state);
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'SESSION_REVOKED',
        subjectType: 'SESSION',
        subjectId: input.sessionId,
        requestId: input.requestId,
        metadata: { reason: 'LOGOUT' },
      });
    });
  }
}
