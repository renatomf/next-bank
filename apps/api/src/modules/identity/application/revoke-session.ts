import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { CurrentSessionNotRevocable } from '../domain/errors.ts';
import { Session } from '../domain/session.ts';
import type { IdentityRepositoriesFactory } from './ports.ts';

export interface RevokeSessionInput {
  /** From the verified access token, never from the request. */
  userId: string;
  currentSessionId: string;
  /** The session to end, from the path. */
  sessionId: string;
  requestId: string | null;
}

export interface RevokeSessionDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Ends another session of the caller from the Security screen: its refresh
 * token stops working at once, as in a sign-out on that device (AUTH-06).
 */
export class RevokeSession {
  readonly #deps: RevokeSessionDependencies;

  constructor(deps: RevokeSessionDependencies) {
    this.#deps = deps;
  }

  async execute(input: RevokeSessionInput): Promise<void> {
    if (input.sessionId === input.currentSessionId) throw new CurrentSessionNotRevocable();
    const now = this.#deps.clock.now();
    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      // Locked like a refresh, so the two cannot interleave.
      const state = await repositories.sessions.lockById(input.sessionId);
      // Someone else's, missing or already over: the same answer (IDOR).
      if (state?.userId !== input.userId) throw new NotFound('Session');
      const session = Session.restore(state);
      if (!session.isActive(now)) throw new NotFound('Session');

      // The table knows LOGOUT, PASSWORD_CHANGED and REFRESH_TOKEN_REUSE: this
      // is a sign-out of that device, and the audit says it came from another.
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
        metadata: { reason: 'LOGOUT', by: 'ANOTHER_SESSION' },
      });
    });
  }
}
