import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { JournalEntryKind, JournalEntryState } from '../domain/journal-entry.ts';
import type { Direction, LedgerAccountState } from '../domain/ledger-account.ts';

/**
 * Where a statement page ends: the posting's time as the database wrote it,
 * with microseconds (a JavaScript Date would round them away), and its id.
 */
export interface StatementPosition {
  createdAt: string;
  postingId: string;
}

/** One posting of a customer account, with the entry it belongs to. */
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

export interface StatementRow {
  postingId: string;
  /** createdAt as text, exact: what the next page continues from. */
  position: string;
  occurredAt: Date;
  direction: Direction;
  amount: Money;
  counterpartyName: string | null;
  counterpartyDocumentMasked: string | null;
  entryKind: JournalEntryKind;
  referenceId: string;
}

export interface LedgerRepository {
  findByCode(code: string): Promise<LedgerAccountState | null>;
  /**
   * Reads the accounts a posting touches. Customer accounts are locked
   * (FOR UPDATE) always in id order, so opposite transfers never deadlock;
   * system accounts are read without a lock, so they never become a queue
   * (database.md, section 7).
   */
  lockForPosting(ids: readonly string[]): Promise<LedgerAccountState[]>;
  insertAccount(account: LedgerAccountState): Promise<void>;
  /** Credits minus debits of one account: a system account's balance (database.md 5.3). */
  postedSum(ledgerAccountId: string): Promise<Money>;
  /** The entry and its postings. */
  insertEntry(entry: JournalEntryState): Promise<void>;
  updateBalance(account: LedgerAccountState): Promise<void>;
  /**
   * The postings of one account, newest first by (created_at, id), after the
   * given position (database.md, section 8). A plain read, without locks.
   */
  statementPage(
    ledgerAccountId: string,
    after: StatementPosition | null,
    limit: number,
    filter: StatementFilter,
  ): Promise<StatementRow[]>;
}

/** Binds the repository to the shared transaction opened by the caller (ADR 0010). */
export interface LedgerRepositoryFactory {
  for(tx: Transaction): LedgerRepository;
}
