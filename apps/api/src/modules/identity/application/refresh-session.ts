import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { RefreshTokenReuseDetected, SessionExpired } from '../domain/errors.ts';
import { Session } from '../domain/session.ts';
import type {
  AccessTokenIssuer,
  IdentityRepositoriesFactory,
  RefreshTokenGenerator,
} from './ports.ts';

export interface RefreshSessionInput {
  refreshToken: string;
  requestId: string | null;
}

export interface RefreshSessionResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export interface RefreshSessionDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  refreshTokens: RefreshTokenGenerator;
  accessTokens: AccessTokenIssuer;
}

type Outcome =
  | { kind: 'ROTATED'; userId: string; sessionId: string; refreshToken: string }
  | { kind: 'REUSE_DETECTED' };

/**
 * Exchanges a refresh token for a new pair (ADR 0004). The session row is locked
 * first, so refreshes and logouts of one session run one at a time; the Session
 * aggregate decides between rotation and reuse (AUTH-03).
 */
export class RefreshSession {
  readonly #deps: RefreshSessionDependencies;

  constructor(deps: RefreshSessionDependencies) {
    this.#deps = deps;
  }

  async execute(input: RefreshSessionInput): Promise<RefreshSessionResult> {
    const { clock, refreshTokens } = this.#deps;
    // Not a token this server could have issued: no database work at all.
    const presentedHash = refreshTokens.hash(input.refreshToken);
    if (presentedHash === null) throw new SessionExpired();
    const now = clock.now();

    const outcome = await this.#deps.unitOfWork.run(async (tx): Promise<Outcome> => {
      const repositories = this.#deps.repositories.for(tx);
      // First read only finds which session to lock.
      const found = await repositories.refreshTokens.findByHash(presentedHash);
      if (found === null) throw new SessionExpired();
      const state = await repositories.sessions.lockById(found.sessionId);
      if (state === null) throw new SessionExpired();
      // Read again under the lock: a simultaneous refresh may have replaced the
      // token meanwhile, and deciding on the first read would rotate it twice.
      const presented = await repositories.refreshTokens.findByHash(presentedHash);
      if (presented === null) throw new SessionExpired();
      const session = Session.restore(state);
      const activeTokenId = await repositories.refreshTokens.findActive(state.id);

      const result = session.refresh(presented, now, activeTokenId);
      if (result.outcome === 'REUSE_DETECTED') {
        // Committed before the error is thrown (ADR 0010, rule 3).
        await repositories.sessions.update(session.state);
        const audited = {
          occurredAt: now,
          actorType: 'SYSTEM',
          actorId: null,
          subjectType: 'SESSION',
          subjectId: state.id,
          requestId: input.requestId,
        } as const;
        await repositories.audit.record({
          ...audited,
          id: this.#deps.ids.next(),
          action: 'REFRESH_REUSE_DETECTED',
          metadata: {},
        });
        await repositories.audit.record({
          ...audited,
          id: this.#deps.ids.next(),
          action: 'SESSION_REVOKED',
          metadata: { reason: 'REFRESH_TOKEN_REUSE' },
        });
        return { kind: 'REUSE_DETECTED' };
      }

      const successor = refreshTokens.generate();
      const successorId = this.#deps.ids.next();
      // Replace first, then insert: one active token per session at every moment
      // (the reference to the successor is checked at commit).
      await repositories.refreshTokens.markReplaced(result.replacedTokenId, successorId, now);
      await repositories.refreshTokens.insert({
        id: successorId,
        sessionId: state.id,
        tokenHash: successor.hash,
        createdAt: now,
      });
      await repositories.sessions.update(session.state);
      return {
        kind: 'ROTATED',
        userId: state.userId,
        sessionId: state.id,
        refreshToken: successor.token,
      };
    });

    if (outcome.kind === 'REUSE_DETECTED') throw new RefreshTokenReuseDetected();
    const access = await this.#deps.accessTokens.issue({
      userId: outcome.userId,
      sessionId: outcome.sessionId,
      now,
    });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: outcome.refreshToken,
    };
  }
}
