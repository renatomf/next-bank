import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { Pin } from '../domain/pin.ts';
import { TransactionPin } from '../domain/transaction-pin.ts';
import type { IdentityRepositoriesFactory, SecretHasher } from './ports.ts';

export interface CreatePinInput {
  /** From the verified access token, never from the request body. */
  userId: string;
  pin: string;
  requestId: string | null;
}

export interface CreatePinDependencies {
  unitOfWork: UnitOfWork;
  repositories: IdentityRepositoriesFactory;
  clock: Clock;
  ids: IdGenerator;
  /** Argon2id with the server-side pepper (API-13). */
  pinHasher: SecretHasher;
}

/**
 * Creates the transaction PIN right after registration (domain-model.md,
 * section 8). Only once: changing it requires the password (D7, week 7).
 */
export class CreatePin {
  readonly #deps: CreatePinDependencies;

  constructor(deps: CreatePinDependencies) {
    this.#deps = deps;
  }

  async execute(input: CreatePinInput): Promise<void> {
    // Validated before any hashing or database work (InvalidPin).
    const pin = Pin.create(input.pin);
    const pinHash = await this.#deps.pinHasher.hash(pin.value);
    const now = this.#deps.clock.now();

    await this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      await repositories.transactionPins.insert(
        TransactionPin.create({ userId: input.userId, pinHash, now }).state,
      );
      await repositories.audit.record({
        id: this.#deps.ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'PIN_CREATED',
        subjectType: 'USER',
        subjectId: input.userId,
        requestId: input.requestId,
        metadata: {},
      });
    });
  }
}
