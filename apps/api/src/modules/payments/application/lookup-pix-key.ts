import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import { PixKeyNotFound, TooManyKeyLookups } from '../domain/errors.ts';
import { type PixKeyType, pixKeyValue } from '../domain/pix-key.ts';
import type { PayeeBank } from '../domain/pix-transfer.ts';
import { findPayeeElsewhere, findPayeeHere } from './find-payee.ts';
import type {
  AccountsPort,
  IdentityPort,
  KeyLookupQuota,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
  SpiPort,
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
  /** Only for a payee at another bank. */
  bank?: PayeeBank;
}

export interface LookupPixKeyDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  accounts: AccountsPort;
  identity: IdentityPort;
  quota: KeyLookupQuota;
  clock: Clock;
  /** The DICT; null while the Pix to other banks is off (P1). */
  spi: SpiPort | null;
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
    const key = { type: input.type, value };
    const { unitOfWork, repositories } = this.#deps;
    const here = await unitOfWork.run((tx) =>
      findPayeeHere(this.#deps, tx, repositories.for(tx), key),
    );
    // Asked with no transaction open: the DICT is a partner that may be slow.
    const payee = here ?? (await findPayeeElsewhere(this.#deps.spi, key));
    if (payee === null) return null;
    return {
      keyType: input.type,
      keyMasked: payee.keyMasked,
      payeeName: payee.name,
      payeeDocumentMasked: payee.documentMasked,
      ...('bank' in payee ? { bank: payee.bank } : {}),
    };
  }
}
