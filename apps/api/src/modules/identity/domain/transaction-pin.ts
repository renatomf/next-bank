import { PinLocked, PinResetRequired } from './errors.ts';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60_000;
// The 3rd lock within this window requires a reset with the password (D7).
const LOCKS_BEFORE_RESET = 3;
const LOCK_WINDOW_MS = 24 * 60 * 60_000;

export interface TransactionPinState {
  userId: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  /** The two most recent lock times: enough for a sliding 24 h window. */
  recentLocks: Date[];
  resetRequired: boolean;
  updatedAt: Date;
}

export type VerificationResult =
  | { outcome: 'VERIFIED' }
  | { outcome: 'INCORRECT'; remainingAttempts: number }
  | { outcome: 'LOCKED'; lockedUntil: Date }
  | { outcome: 'RESET_REQUIRED' };

/**
 * The second factor checked by the server on every Pix (ADR 0004). Comparing
 * the PIN with its hash happens outside the domain; this aggregate counts the
 * attempts and enforces the lock against brute force.
 */
export class TransactionPin {
  #state: TransactionPinState;

  private constructor(state: TransactionPinState) {
    this.#state = { ...state, recentLocks: [...state.recentLocks] };
  }

  static create(input: { userId: string; pinHash: string; now: Date }): TransactionPin {
    return new TransactionPin({
      userId: input.userId,
      pinHash: input.pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      recentLocks: [],
      resetRequired: false,
      updatedAt: input.now,
    });
  }

  static restore(state: TransactionPinState): TransactionPin {
    return new TransactionPin(state);
  }

  get state(): Readonly<TransactionPinState> {
    return { ...this.#state, recentLocks: [...this.#state.recentLocks] };
  }

  /**
   * Called before hashing, so a locked PIN costs no CPU and reveals nothing.
   * An expired lock gives a fresh set of attempts; a required reset never expires.
   */
  assertCanVerify(now: Date): void {
    if (this.#state.resetRequired) throw new PinResetRequired();
    const { lockedUntil } = this.#state;
    if (lockedUntil === null) return;
    if (now < lockedUntil) throw new PinLocked(lockedUntil);

    this.#state.failedAttempts = 0;
    this.#state.lockedUntil = null;
    this.#state.updatedAt = now;
  }

  recordVerification(matched: boolean, now: Date): VerificationResult {
    if (this.#state.lockedUntil !== null || this.#state.resetRequired) {
      throw new Error('PIN is locked or needs a reset: call assertCanVerify first');
    }
    this.#state.updatedAt = now;

    if (matched) {
      this.#state.failedAttempts = 0;
      return { outcome: 'VERIFIED' };
    }

    this.#state.failedAttempts += 1;
    if (this.#state.failedAttempts < MAX_FAILED_ATTEMPTS) {
      return {
        outcome: 'INCORRECT',
        remainingAttempts: MAX_FAILED_ATTEMPTS - this.#state.failedAttempts,
      };
    }
    return this.#lock(now);
  }

  /**
   * A new PIN, after the password was checked (domain-model.md 3.1). The
   * password proves the person, so every lock and its history goes: this is
   * how a PIN that needed a reset works again (week 7 plan, D5).
   */
  change(newPinHash: string, now: Date): void {
    this.#state = {
      ...this.#state,
      pinHash: newPinHash,
      failedAttempts: 0,
      lockedUntil: null,
      recentLocks: [],
      resetRequired: false,
      updatedAt: now,
    };
  }

  #lock(now: Date): VerificationResult {
    const locks = [...this.#state.recentLocks, now];
    const windowStart = now.getTime() - LOCK_WINDOW_MS;
    const locksInWindow = locks.filter((lockedAt) => lockedAt.getTime() > windowStart).length;
    // Only the latest locks can still fall in a future window.
    this.#state.recentLocks = locks.slice(-(LOCKS_BEFORE_RESET - 1));

    if (locksInWindow >= LOCKS_BEFORE_RESET) {
      this.#state.resetRequired = true;
      return { outcome: 'RESET_REQUIRED' };
    }
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    this.#state.lockedUntil = lockedUntil;
    return { outcome: 'LOCKED', lockedUntil };
  }
}
