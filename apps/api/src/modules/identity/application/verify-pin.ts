import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { PinIncorrect, PinLocked, PinNotCreated, PinResetRequired } from '../domain/errors.ts';
import { TransactionPin, type VerificationResult } from '../domain/transaction-pin.ts';
import type { IdentityRepositoriesFactory, SecretHasher } from './ports.ts';

export interface VerifyPinInput {
  /** From the verified access token, never from the request body. */
  userId: string;
  pin: string;
  requestId: string | null;
}

export interface VerifyPinDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  /** Argon2id with the server-side pepper (API-13). */
  pinHasher: SecretHasher;
}

/**
 * Checks the transaction PIN on the server (ADR 0004), on one counter for the
 * Unlock screen and every Pix (F-16, PIX-05).
 */
export class VerifyPin {
  readonly #deps: VerifyPinDependencies;

  constructor(deps: VerifyPinDependencies) {
    this.#deps = deps;
  }

  /** The Unlock route: commits the attempt, then answers with the catalog error. */
  async execute(input: VerifyPinInput): Promise<void> {
    const result = await this.#deps.unitOfWork.run((tx) => this.verify(tx, input));
    switch (result.outcome) {
      case 'VERIFIED':
        return;
      case 'INCORRECT':
        throw new PinIncorrect(result.remainingAttempts);
      case 'LOCKED':
        throw new PinLocked(result.lockedUntil);
      case 'RESET_REQUIRED':
        throw new PinResetRequired();
    }
  }

  /**
   * Inside the caller's transaction (the Pix, database.md section 7): the PIN
   * stays locked until it commits, and the outcome comes back as a value so the
   * caller can record it before answering (ADR 0010, rule 3).
   */
  async verify(tx: Transaction, input: VerifyPinInput): Promise<VerificationResult> {
    const repositories = this.#deps.repositories.for(tx);
    const state = await repositories.transactionPins.lockByUserId(input.userId);
    if (state === null) throw new PinNotCreated();

    const now = this.#deps.clock.now();
    const pin = TransactionPin.restore(state);
    try {
      pin.assertCanVerify(now);
    } catch (error) {
      // A lock already in force: nothing changed, nothing to record.
      if (error instanceof PinLocked) return { outcome: 'LOCKED', lockedUntil: error.lockedUntil };
      if (error instanceof PinResetRequired) return { outcome: 'RESET_REQUIRED' };
      throw error;
    }

    const matched = await this.#deps.pinHasher.verify(state.pinHash, input.pin);
    const result = pin.recordVerification(matched, now);
    await repositories.transactionPins.update(pin.state);
    if (result.outcome === 'LOCKED' || result.outcome === 'RESET_REQUIRED') {
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'PIN_LOCKED',
        subjectType: 'USER',
        subjectId: input.userId,
        requestId: input.requestId,
        metadata: {},
      });
    }
    return result;
  }
}
