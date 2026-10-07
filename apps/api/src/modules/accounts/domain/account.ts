export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED';

/** The only branch in V1. */
const BRANCH = '0001';

export interface AccountState {
  id: string;
  holderUserId: string;
  branch: string;
  /** Six digits, a hyphen and the mod-11 check digit, e.g. "100000-4". */
  number: string;
  status: AccountStatus;
  openedAt: Date;
  updatedAt: Date;
}

/**
 * A customer's current account (domain-model.md 3.2). It never holds a
 * balance: the money lives in the ledger.
 */
export class Account {
  readonly #state: AccountState;

  private constructor(state: AccountState) {
    this.#state = { ...state };
  }

  /** Opens the account with the [sequence] value the database handed out. */
  static open(input: { id: string; holderUserId: string; sequence: number; now: Date }): Account {
    return new Account({
      id: input.id,
      holderUserId: input.holderUserId,
      branch: BRANCH,
      number: accountNumberFrom(input.sequence),
      status: 'ACTIVE',
      openedAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(state: AccountState): Account {
    return new Account(state);
  }

  get state(): Readonly<AccountState> {
    return { ...this.#state };
  }
}

/**
 * Six digits from the sequence plus a mod-11 check digit: weights 2 to 7 from
 * the rightmost digit; a result of 10 or 11 becomes 0.
 */
export function accountNumberFrom(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 100_000 || sequence > 999_999) {
    throw new RangeError(`account sequence ${String(sequence)} is not six digits`);
  }
  const digits = String(sequence);
  const sum = Array.from(digits)
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index + 2), 0);
  const checkDigit = 11 - (sum % 11);
  return `${digits}-${String(checkDigit >= 10 ? 0 : checkDigit)}`;
}
