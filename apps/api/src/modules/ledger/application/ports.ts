import type { Transaction } from '../../../shared/application/ports.ts';
import type { JournalEntryState } from '../domain/journal-entry.ts';
import type { LedgerAccountState } from '../domain/ledger-account.ts';

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
  /** The entry and its postings. */
  insertEntry(entry: JournalEntryState): Promise<void>;
  updateBalance(account: LedgerAccountState): Promise<void>;
}

/** Binds the repository to the shared transaction opened by the caller (ADR 0010). */
export interface LedgerRepositoryFactory {
  for(tx: Transaction): LedgerRepository;
}
