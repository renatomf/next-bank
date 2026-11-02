import { StaffSessionExpired } from './errors.ts';

const IDLE_LIMIT_MS = 15 * 60_000;
const LIFETIME_MS = 8 * 60 * 60_000;

export interface StaffSessionState {
  id: string;
  memberId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * A session of the staff (v1.3.0 plan, task 1; STF-06): it ends after 15
 * minutes without use, after 8 hours however much it is used, or at once
 * when revoked. Shorter than a customer's: it opens every customer's data.
 */
export class StaffSession {
  #state: StaffSessionState;

  private constructor(state: StaffSessionState) {
    this.#state = { ...state };
  }

  static open(input: { id: string; memberId: string; now: Date }): StaffSession {
    return new StaffSession({
      id: input.id,
      memberId: input.memberId,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: new Date(input.now.getTime() + LIFETIME_MS),
      revokedAt: null,
    });
  }

  static restore(state: StaffSessionState): StaffSession {
    return new StaffSession(state);
  }

  get state(): StaffSessionState {
    return { ...this.#state };
  }

  assertUsable(now: Date): void {
    const { revokedAt, expiresAt, lastSeenAt } = this.#state;
    if (
      revokedAt !== null ||
      now >= expiresAt ||
      now.getTime() - lastSeenAt.getTime() >= IDLE_LIMIT_MS
    ) {
      throw new StaffSessionExpired();
    }
  }

  /** A use of the session: it stays alive, never past its 8 hours. */
  touch(now: Date): void {
    this.assertUsable(now);
    this.#state.lastSeenAt = now;
  }

  /** Ends the session; revoking it again keeps the first time. */
  revoke(now: Date): void {
    if (this.#state.revokedAt === null) this.#state.revokedAt = now;
  }
}
