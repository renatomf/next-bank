import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import type { IdentityRepositoriesFactory } from './ports.ts';

/** An active session as the Security screen shows it: no IP, token or user. */
export interface ActiveSessionView {
  id: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  /** The session of the token that asked. */
  current: boolean;
}

export interface ListSessionsDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
}

/** The caller's active sessions, most recently used first (ASVS session). */
export class ListSessions {
  readonly #deps: ListSessionsDependencies;

  constructor(deps: ListSessionsDependencies) {
    this.#deps = deps;
  }

  /** [userId] and [sessionId] come from the verified access token. */
  async execute(input: { userId: string; sessionId: string }): Promise<ActiveSessionView[]> {
    const now = this.#deps.clock.now();
    const sessions = await this.#deps.unitOfWork.run((tx) =>
      this.#deps.repositories.for(tx).sessions.listActive(input.userId, now),
    );
    return sessions.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      current: session.id === input.sessionId,
    }));
  }
}
