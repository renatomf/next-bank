import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { JournalEntry, type JournalEntryKind, type PostingInput } from '../domain/journal-entry.ts';
import { LedgerAccount } from '../domain/ledger-account.ts';
import type { LedgerRepositoryFactory } from './ports.ts';

export interface PostJournalEntryInput {
  kind: JournalEntryKind;
  referenceType: string;
  referenceId: string;
  postings: Omit<PostingInput, 'id'>[];
}

/**
 * Records a journal entry and applies it to the customer balances, inside the
 * caller's transaction (ADR 0005, ADR 0007). Every balance is checked before
 * anything is written, so a refused debit leaves no trace; the database checks
 * the same again at COMMIT.
 */
export class PostJournalEntry {
  readonly #repositories: LedgerRepositoryFactory;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;

  constructor(deps: { repositories: LedgerRepositoryFactory; clock: Clock; ids: IdGenerator }) {
    this.#repositories = deps.repositories;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  async execute(tx: Transaction, input: PostJournalEntryInput): Promise<string> {
    const entry = JournalEntry.record({
      id: this.#ids.next(),
      kind: input.kind,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      postings: input.postings.map((posting) => ({ ...posting, id: this.#ids.next() })),
      now: this.#clock.now(),
    });
    const repository = this.#repositories.for(tx);

    const accountIds = [...new Set(entry.state.postings.map((p) => p.ledgerAccountId))];
    const accounts = new Map(
      (await repository.lockForPosting(accountIds)).map((state) => [
        state.id,
        LedgerAccount.restore(state),
      ]),
    );
    for (const posting of entry.state.postings) {
      const account = accounts.get(posting.ledgerAccountId);
      if (!account) throw new Error(`Ledger account ${posting.ledgerAccountId} does not exist`);
      account.post(posting.direction, posting.amount);
    }

    await repository.insertEntry(entry.state);
    for (const account of accounts.values()) {
      if (account.state.kind === 'CUSTOMER') await repository.updateBalance(account.state);
    }
    return entry.state.id;
  }
}
