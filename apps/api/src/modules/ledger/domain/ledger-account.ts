import { Money } from '../../../shared/domain/money.ts';
import { InsufficientFunds } from './errors.ts';

export type LedgerAccountKind = 'CUSTOMER' | 'SYSTEM';
export type Direction = 'DEBIT' | 'CREDIT';

export interface LedgerAccountState {
  id: string;
  /** `customer:<accountId>` or `system:<name>` (domain-model.md, section 5). */
  code: string;
  kind: LedgerAccountKind;
  postedBalance: Money;
  /** Posted balance minus holds; always equal to it in V1 (no holds yet). */
  availableBalance: Money;
  /** Counts balance changes. */
  version: number;
  createdAt: Date;
}

/**
 * An account of the ledger (domain-model.md 3.3). Balance = credits − debits:
 * for a customer, a credit raises it and a debit lowers it, never below zero.
 * A system account has no materialized balance (database.md 5.3).
 */
export class LedgerAccount {
  readonly #state: LedgerAccountState;

  private constructor(state: LedgerAccountState) {
    this.#state = { ...state };
  }

  static openCustomer(input: { id: string; accountId: string; now: Date }): LedgerAccount {
    return new LedgerAccount({
      id: input.id,
      code: `customer:${input.accountId}`,
      kind: 'CUSTOMER',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: input.now,
    });
  }

  static restore(state: LedgerAccountState): LedgerAccount {
    return new LedgerAccount(state);
  }

  get state(): Readonly<LedgerAccountState> {
    return { ...this.#state };
  }

  /** Applies one posting of a journal entry to the balance. */
  post(direction: Direction, amount: Money): void {
    if (!amount.isPositive()) throw new RangeError('A posting amount must be positive');
    // A system account's balance is the sum of its postings, computed by the
    // reconciliation: updating it here would make it a hot account.
    if (this.#state.kind === 'SYSTEM') return;

    const change = direction === 'CREDIT' ? amount : Money.zero().minus(amount);
    const available = this.#state.availableBalance.plus(change);
    if (available.isNegative()) throw new InsufficientFunds();

    this.#state.postedBalance = this.#state.postedBalance.plus(change);
    this.#state.availableBalance = available;
    this.#state.version += 1;
  }
}
