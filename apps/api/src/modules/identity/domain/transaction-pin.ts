import { PinLocked } from './errors.ts';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60_000;

export interface TransactionPinState {
  userId: string;
  pinHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  updatedAt: Date;
}

export type VerificationResult =
  | { outcome: 'VERIFIED' }
  | { outcome: 'INCORRECT'; remainingAttempts: number }
  | { outcome: 'LOCKED'; lockedUntil: Date };

/**
 * The second factor checked by the server on every Pix (ADR 0004). Comparing
 * the PIN with its hash happens outside the domain; this aggregate counts the
 * attempts and enforces the lock against brute force.
 */
export class TransactionPin {
  #state: TransactionPinState;

  private constructor(state: TransactionPinState) {
    this.#state = { ...state };
  }

  static create(input: { userId: string; pinHash: string; now: Date }): TransactionPin {
    return new TransactionPin({
      userId: input.userId,
      pinHash: input.pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: input.now,
    });
  }

  static restore(state: TransactionPinState): TransactionPin {
    return new TransactionPin(state);
  }

  get state(): Readonly<TransactionPinState> {
    return { ...this.#state };
  }

  /**
   * Called before hashing, so a locked PIN costs no CPU and reveals nothing.
   * An expired lock gives a fresh set of attempts.
   */
  assertCanVerify(now: Date): void {
    const { lockedUntil } = this.#state;
    if (lockedUntil === null) return;
    if (now < lockedUntil) throw new PinLocked(lockedUntil);

    this.#state.failedAttempts = 0;
    this.#state.lockedUntil = null;
    this.#state.updatedAt = now;
  }

  recordVerification(matched: boolean, now: Date): VerificationResult {
    if (this.#state.lockedUntil !== null) {
      throw new Error('PIN is locked: call assertCanVerify first');
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
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    this.#state.lockedUntil = lockedUntil;
    return { outcome: 'LOCKED', lockedUntil };
  }
}
