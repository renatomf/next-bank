import { Money } from '../../../shared/domain/money.ts';
import type { Direction } from './ledger-account.ts';

export type JournalEntryKind =
  | 'FUNDING'
  | 'PIX_INTERNAL'
  | 'TOP_UP'
  | 'PIX_EXTERNAL'
  | 'PIX_EXTERNAL_SETTLEMENT'
  | 'PIX_EXTERNAL_REFUND';

export interface PostingInput {
  id: string;
  ledgerAccountId: string;
  direction: Direction;
  amount: Money;
  /** Snapshot of who is on the other side, so the statement reads only the ledger. */
  counterpartyName: string | null;
  counterpartyDocumentMasked: string | null;
}

export interface JournalEntryState {
  id: string;
  kind: JournalEntryKind;
  /** What caused the entry, e.g. the account funded or the Pix completed. */
  referenceType: string;
  referenceId: string;
  postings: PostingInput[];
  createdAt: Date;
}

/**
 * A bug in the caller, not a business refusal: no client request can build an
 * unbalanced entry. The database refuses it again at COMMIT (T-DB-02).
 */
export class UnbalancedJournalEntry extends Error {}

/**
 * An immutable accounting fact (domain-model.md 3.3; ADR 0005): two or more
 * positive postings whose debits equal their credits. A mistake is corrected
 * only by a new reversal entry.
 */
export class JournalEntry {
  readonly #state: JournalEntryState;

  private constructor(state: JournalEntryState) {
    this.#state = state;
  }

  static record(input: {
    id: string;
    kind: JournalEntryKind;
    referenceType: string;
    referenceId: string;
    postings: PostingInput[];
    now: Date;
  }): JournalEntry {
    const { postings } = input;
    if (postings.length < 2) {
      throw new UnbalancedJournalEntry('A journal entry needs at least two postings');
    }
    if (postings.some((posting) => !posting.amount.isPositive())) {
      throw new UnbalancedJournalEntry('Every posting amount must be positive');
    }
    if (!sumOf(postings, 'DEBIT').equals(sumOf(postings, 'CREDIT'))) {
      throw new UnbalancedJournalEntry('Debits must equal credits');
    }
    return new JournalEntry({
      id: input.id,
      kind: input.kind,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      postings: postings.map((posting) => ({ ...posting })),
      createdAt: input.now,
    });
  }

  get state(): Readonly<JournalEntryState> {
    return { ...this.#state, postings: this.#state.postings.map((posting) => ({ ...posting })) };
  }
}

function sumOf(postings: PostingInput[], direction: Direction): Money {
  return postings
    .filter((posting) => posting.direction === direction)
    .reduce((total, posting) => total.plus(posting.amount), Money.zero());
}
