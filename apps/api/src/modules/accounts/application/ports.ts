import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { AccountState } from '../domain/account.ts';

export interface AccountsRepository {
  /** The next value of the account number sequence; safe without a lock. */
  nextSequence(): Promise<number>;
  insert(account: AccountState): Promise<void>;
  /** The account of a customer: one per customer in V1. */
  findByHolder(userId: string): Promise<AccountState | null>;
  findById(id: string): Promise<AccountState | null>;
  /** In id order, so two Pix in opposite directions never wait on each other. */
  lockForShare(ids: string[]): Promise<AccountState[]>;
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
  /** One page of the account's statement, newest first (domain-model.md 8.1). */
  statement(
    tx: Transaction,
    accountId: string,
    after: StatementPosition | null,
    filter: StatementFilter,
  ): Promise<StatementPage>;
}

/**
 * What narrows a statement page (v1.1.0 plan, task 4.1): one kind at a time
 * and part of the counterparty's name, both optional.
 */
export interface StatementFilter {
  kind: 'IN' | 'OUT' | 'PIX' | 'RECEIPT' | null;
  search: string | null;
}

/** No filter: the whole statement. */
export const NO_STATEMENT_FILTER: StatementFilter = { kind: null, search: null };

/** Where a statement page ends; opaque to Accounts, which only passes it back. */
export interface StatementPosition {
  createdAt: string;
  postingId: string;
}

export interface StatementItem {
  id: string;
  occurredAt: Date;
  kind: 'PIX_SENT' | 'PIX_RECEIVED' | 'PIX_REFUNDED' | 'DEMO_FUNDING' | 'TOP_UP';
  direction: 'IN' | 'OUT';
  amount: Money;
  counterparty: { name: string; documentMasked: string | null } | null;
  transferId: string | null;
  /** The top-up of a TOP_UP item: the link to its receipt (v1.1.0 plan, task 5). */
  topUpId: string | null;
}

export interface StatementPage {
  items: StatementItem[];
  next: StatementPosition | null;
}
