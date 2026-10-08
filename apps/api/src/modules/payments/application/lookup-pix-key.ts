import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import { PixKeyNotFound, TooManyKeyLookups } from '../domain/errors.ts';
import { type PixKeyType, pixKeyValue } from '../domain/pix-key.ts';
import type {
  AccountsPort,
  IdentityPort,
  KeyLookupQuota,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
} from './ports.ts';

export interface LookupPixKeyInput {
  /** From the verified access token: the quota is per customer. */
  customerId: string;
  type: PixKeyType;
  value: string;
}

/** Who receives, as screen 7 shows it: never the full CPF (D6). */
export interface PixKeyLookup {
  keyType: PixKeyType;
  keyMasked: string;
  payeeName: string;
  payeeDocumentMasked: string;
}

export interface LookupPixKeyDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  accounts: AccountsPort;
  identity: IdentityPort;
  quota: KeyLookupQuota;
  clock: Clock;
}

/** A missing key costs one more lookup: sweeping for names runs out twice as fast. */
const MISS_PENALTY = 1;

/** Finds who receives a Pix by a key (domain-model.md 11, screen 7; PIX-07). */
export class LookupPixKey {
  readonly #deps: LookupPixKeyDependencies;

  constructor(deps: LookupPixKeyDependencies) {
    this.#deps = deps;
  }

  async execute(input: LookupPixKeyInput): Promise<PixKeyLookup> {
    const { quota, clock } = this.#deps;
    const now = clock.now();
    // Taken before any await, so lookups fired at once cannot overrun it (F-11).
    if (!quota.tryTake(input.customerId, 1, now)) throw new TooManyKeyLookups();

    const found = await this.#find(input);
    if (found === null) {
      quota.charge(input.customerId, MISS_PENALTY, now);
      throw new PixKeyNotFound();
    }
    return found;
  }

  async #find(input: LookupPixKeyInput): Promise<PixKeyLookup | null> {
    let value: string;
    try {
      value = pixKeyValue(input.type, input.value);
    } catch {
      // A value no key can have is a miss like any other.
      return null;
    }
    const { unitOfWork, repositories, protector, accounts, identity } = this.#deps;
    return unitOfWork.run(async (tx) => {
      const key = await repositories
        .for(tx)
        .pixKeys.findByIndex(input.type, protector.blindIndex(input.type, value));
      if (key === null) return null;
      const account = await accounts.findById(tx, key.accountId);
      const payee = account && (await identity.payeeOf(tx, account.holderUserId));
      // A key always belongs to an account with a holder: anything else is a bug.
      if (!payee) throw new Error(`Pix key without a payee for account ${key.accountId}`);
      return {
        keyType: input.type,
        keyMasked: key.masked,
        payeeName: payee.name,
        payeeDocumentMasked: payee.documentMasked,
      };
    });
  }
}
