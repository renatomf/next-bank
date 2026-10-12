import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { DemoAccountRestricted, PinNotCreated, Unauthenticated } from '../domain/errors.ts';
import { Pin } from '../domain/pin.ts';
import { TransactionPin } from '../domain/transaction-pin.ts';
import { confirmPassword } from './confirm-password.ts';
import type { IdentityRepositoriesFactory, LoginAttemptsStore, SecretHasher } from './ports.ts';

export interface ChangePinInput {
  /** From the verified access token, never from the request body. */
  userId: string;
  password: string;
  newPin: string;
  requestId: string | null;
}

export interface ChangePinDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  /** The password hasher, to check the password. */
  hasher: SecretHasher;
  /** Argon2id with the server-side pepper (API-13), for the new PIN. */
  pinHasher: SecretHasher;
  /** The login's counter: wrong passwords here count with the login's (AUTH-01). */
  attempts: LoginAttemptsStore;
}

/**
 * A new transaction PIN with the password (domain-model.md 3.1): also how a PIN
 * locked or in need of a reset works again (week 7 plan, D5).
 */
export class ChangePin {
  readonly #deps: ChangePinDependencies;

  constructor(deps: ChangePinDependencies) {
    this.#deps = deps;
  }

  async execute(input: ChangePinInput): Promise<void> {
    // A malformed PIN spends none of the password's attempts.
    const newPin = Pin.create(input.newPin);
    const now = this.#deps.clock.now();
    const credentials = await this.#deps.unitOfWork.run((tx) =>
      this.#deps.repositories.for(tx).users.findCredentials(input.userId),
    );
    // The token names a user that no longer exists: nothing to change.
    if (credentials === null) throw new Unauthenticated();
    // Before the password: a refused change spends none of its attempts.
    if (credentials.isDemo) throw new DemoAccountRestricted();
    await confirmPassword(this.#deps, credentials, input.password, now);

    const pinHash = await this.#deps.pinHasher.hash(newPin.value);
    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      // Locked like a verification, so a guess in flight never counts on the new PIN.
      const state = await repositories.transactionPins.lockByUserId(input.userId);
      if (state === null) throw new PinNotCreated();
      const pin = TransactionPin.restore(state);
      pin.change(pinHash, now);
      await repositories.transactionPins.update(pin.state);
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'PIN_CHANGED',
        subjectType: 'USER',
        subjectId: input.userId,
        requestId: input.requestId,
        metadata: {},
      });
    });
  }
}
