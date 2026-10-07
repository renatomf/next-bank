import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { AccountState } from '../domain/account.ts';

export interface AccountsRepository {
  /** The next value of the account number sequence; safe without a lock. */
  nextSequence(): Promise<number>;
  insert(account: AccountState): Promise<void>;
  /** The account of a customer: one per customer in V1. */
  findByHolder(userId: string): Promise<AccountState | null>;
}

export interface AccountsRepositories {
  accounts: AccountsRepository;
  audit: AuditTrail;
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface AccountsRepositoriesFactory {
  for(tx: Transaction): AccountsRepositories;
}

/**
 * What Accounts needs from the ledger (context map, domain-model.md section 2).
 * Defined here, by the caller; the ledger implements it.
 */
export interface LedgerPort {
  /** Every current account has its own ledger account. */
  open(tx: Transaction, accountId: string): Promise<void>;
  /** The money lives in the ledger: an account never holds a balance. */
  availableBalance(tx: Transaction, accountId: string): Promise<Money | null>;
}
