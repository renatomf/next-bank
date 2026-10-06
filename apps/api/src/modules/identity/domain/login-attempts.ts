import { TooManyAttempts } from './errors.ts';

const MAX_FAILURES = 5;
const WINDOW_MS = 60_000;
const FIRST_BLOCK_MS = 60_000;
const LONGEST_BLOCK_MS = 15 * 60_000;

export interface LoginAttemptsState {
  /** Wrong attempts within the last minute. */
  recentFailures: Date[];
  blockedUntil: Date | null;
  /** Blocks since the last successful login: each one doubles the next. */
  consecutiveBlocks: number;
}

/**
 * Brute force protection for one account (AUTH-01): 5 wrong attempts within a
 * sliding minute block its logins. Instead of slowing each request down (which
 * would hold connections), blocks grow: 1, 2, 4, 8 minutes, then at most 15.
 */
export class LoginAttempts {
  #state: LoginAttemptsState;

  private constructor(state: LoginAttemptsState) {
    this.#state = { ...state, recentFailures: [...state.recentFailures] };
  }

  static none(): LoginAttempts {
    return new LoginAttempts({ recentFailures: [], blockedUntil: null, consecutiveBlocks: 0 });
  }

  static restore(state: LoginAttemptsState): LoginAttempts {
    return new LoginAttempts(state);
  }

  get state(): LoginAttemptsState {
    return { ...this.#state, recentFailures: [...this.#state.recentFailures] };
  }

  /** Checked before verifying the password, so a blocked account costs no hashing. */
  assertAllowed(now: Date): void {
    const { blockedUntil } = this.#state;
    if (blockedUntil !== null && now < blockedUntil) throw new TooManyAttempts();
  }

  recordFailure(now: Date): void {
    const windowStart = now.getTime() - WINDOW_MS;
    const failures = [...this.#state.recentFailures, now].filter(
      (failedAt) => failedAt.getTime() > windowStart,
    );
    if (failures.length < MAX_FAILURES) {
      this.#state.recentFailures = failures;
      return;
    }
    const duration = Math.min(
      FIRST_BLOCK_MS * 2 ** this.#state.consecutiveBlocks,
      LONGEST_BLOCK_MS,
    );
    this.#state = {
      recentFailures: [],
      blockedUntil: new Date(now.getTime() + duration),
      consecutiveBlocks: this.#state.consecutiveBlocks + 1,
    };
  }

  /** The right password proves the person: earlier failures no longer count. */
  recordSuccess(): void {
    this.#state = { recentFailures: [], blockedUntil: null, consecutiveBlocks: 0 };
  }
}
