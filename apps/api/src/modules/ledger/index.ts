// Public API of the ledger context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator } from '../../shared/application/ports.ts';
import { CustomerLedgerAccounts } from './application/customer-ledger-accounts.ts';
import { PostJournalEntry } from './application/post-journal-entry.ts';
import { PgLedgerRepositories } from './infrastructure/pg-ledger-repository.ts';

export type { CustomerLedgerAccounts } from './application/customer-ledger-accounts.ts';
export type { PostJournalEntry, PostJournalEntryInput } from './application/post-journal-entry.ts';

export interface LedgerModule {
  customerAccounts: CustomerLedgerAccounts;
  /** Used by the Pix in week 5; funding goes through customerAccounts. */
  postJournalEntry: PostJournalEntry;
}

/** Builds the ledger context with its production adapters. */
export function createLedgerModule(settings: { clock: Clock; ids: IdGenerator }): LedgerModule {
  const repositories = new PgLedgerRepositories();
  const postJournalEntry = new PostJournalEntry({ repositories, ...settings });
  return {
    customerAccounts: new CustomerLedgerAccounts({ repositories, ...settings, postJournalEntry }),
    postJournalEntry,
  };
}
