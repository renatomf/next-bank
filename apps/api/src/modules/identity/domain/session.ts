import { SessionExpired } from './errors.ts';

const SECOND = 1_000;
const DAY = 24 * 60 * 60 * SECOND;
const IDLE_TIMEOUT_MS = 7 * DAY;
const ABSOLUTE_LIFETIME_MS = 30 * DAY;
// A client whose refresh response was lost retries with the old token right away.
const REUSE_GRACE_MS = 10 * SECOND;

export type RevokedReason = 'LOGOUT' | 'REFRESH_TOKEN_REUSE' | 'PASSWORD_CHANGED';

export interface SessionState {
  id: string;
  userId: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RevokedReason | null;
}

/** What the session needs to know about a stored refresh token (never the token itself). */
export interface IssuedRefreshToken {
  id: string;
  sessionId: string;
  replacedAt: Date | null;
  replacedById: string | null;
}

export type RefreshResult =
  { outcome: 'ROTATED'; replacedTokenId: string } | { outcome: 'REUSE_DETECTED' };

/**
 * A login on one device: a family of refresh tokens where each refresh
 * replaces the previous token (ADR 0004).
 */
export class Session {
  #state: SessionState;

  private constructor(state: SessionState) {
    this.#state = { ...state };
  }

  static create(input: {
    id: string;
    userId: string;
    deviceLabel: string | null;
    now: Date;
  }): Session {
    const absoluteExpiresAt = addMs(input.now, ABSOLUTE_LIFETIME_MS);
    return new Session({
      id: input.id,
      userId: input.userId,
      deviceLabel: input.deviceLabel,
      createdAt: input.now,
      lastUsedAt: input.now,
      idleExpiresAt: earliest(addMs(input.now, IDLE_TIMEOUT_MS), absoluteExpiresAt),
      absoluteExpiresAt,
      revokedAt: null,
      revokedReason: null,
    });
  }

  static restore(state: SessionState): Session {
    return new Session(state);
  }

  get state(): Readonly<SessionState> {
    return { ...this.#state };
  }

  isActive(now: Date): boolean {
    const s = this.#state;
    return s.revokedAt === null && now < s.idleExpiresAt && now < s.absoluteExpiresAt;
  }

  /**
   * Decides which token a refresh replaces. A replaced token presented again
   * means a copy exists elsewhere, so the whole session is revoked (AUTH-03),
   * unless it is the immediate retry of a lost response: within 10 s and while
   * its successor is still the active token. Tokens are stored only as hashes,
   * so the retry gets a new pair rotated from the active token.
   */
  refresh(
    presented: IssuedRefreshToken,
    now: Date,
    activeTokenId: string | null = null,
  ): RefreshResult {
    if (presented.sessionId !== this.#state.id) {
      throw new Error('Refresh token belongs to another session');
    }
    if (!this.isActive(now)) throw new SessionExpired();

    if (presented.replacedAt === null) return this.#rotate(presented.id, now);

    const isLostResponseRetry =
      now.getTime() - presented.replacedAt.getTime() <= REUSE_GRACE_MS &&
      activeTokenId !== null &&
      presented.replacedById === activeTokenId;
    if (isLostResponseRetry) return this.#rotate(activeTokenId, now);

    this.revoke('REFRESH_TOKEN_REUSE', now);
    return { outcome: 'REUSE_DETECTED' };
  }

  /** Revoking twice keeps the first reason: it is the one that explains what happened. */
  revoke(reason: RevokedReason, now: Date): void {
    if (this.#state.revokedAt !== null) return;
    this.#state.revokedAt = now;
    this.#state.revokedReason = reason;
  }

  #rotate(replacedTokenId: string, now: Date): RefreshResult {
    this.#state.lastUsedAt = now;
    this.#state.idleExpiresAt = earliest(
      addMs(now, IDLE_TIMEOUT_MS),
      this.#state.absoluteExpiresAt,
    );
    return { outcome: 'ROTATED', replacedTokenId };
  }
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

function earliest(a: Date, b: Date): Date {
  return a <= b ? a : b;
}
