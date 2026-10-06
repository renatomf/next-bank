import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { Session } from '../domain/session.ts';
import type { IdentityRepositoriesFactory } from './ports.ts';

/**
 * An access token stays valid up to 15 minutes after its session ends (ADR 0004).
 * Sensitive operations ask the database whether the session is still active
 * (AUTH-04): a plain read, so it never waits for a refresh or a logout.
 */
export class ActiveSessions {
  readonly #unitOfWork: UnitOfWork;
  readonly #repositories: IdentityRepositoriesFactory;

  constructor(deps: { unitOfWork: UnitOfWork; repositories: IdentityRepositoriesFactory }) {
    this.#unitOfWork = deps.unitOfWork;
    this.#repositories = deps.repositories;
  }

  async isActive(sessionId: string, now: Date): Promise<boolean> {
    const state = await this.#unitOfWork.run((tx) =>
      this.#repositories.for(tx).sessions.findById(sessionId),
    );
    return state !== null && Session.restore(state).isActive(now);
  }
}
