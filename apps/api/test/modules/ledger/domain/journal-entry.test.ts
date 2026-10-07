import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import {
  JournalEntry,
  type PostingInput,
  UnbalancedJournalEntry,
} from '../../../../src/modules/ledger/domain/journal-entry.ts';

// Journal entry (domain-model.md 3.3; ADR 0005): at least two postings,
// positive amounts and debits equal to credits. The database checks the same
// at COMMIT (T-DB-02); here it fails before any SQL runs.
const NOW = new Date('2026-10-07T12:00:00.000Z');

function posting(
  ledgerAccountId: string,
  direction: 'DEBIT' | 'CREDIT',
  cents: bigint,
): PostingInput {
  return {
    id: `posting-${ledgerAccountId}-${direction}`,
    ledgerAccountId,
    direction,
    amount: Money.of(cents),
    counterpartyName: 'next bank',
    counterpartyDocumentMasked: null,
  };
}

function record(postings: PostingInput[]): JournalEntry {
  return JournalEntry.record({
    id: 'entry-1',
    kind: 'FUNDING',
    referenceType: 'ACCOUNT',
    referenceId: 'account-1',
    postings,
    now: NOW,
  });
}

describe('JournalEntry', () => {
  it('records a balanced funding: debit system:funding, credit the customer', () => {
    const entry = record([
      posting('funding', 'DEBIT', 1_000_000n),
      posting('customer', 'CREDIT', 1_000_000n),
    ]);

    expect(entry.state).toEqual({
      id: 'entry-1',
      kind: 'FUNDING',
      referenceType: 'ACCOUNT',
      referenceId: 'account-1',
      createdAt: NOW,
      postings: [
        posting('funding', 'DEBIT', 1_000_000n),
        posting('customer', 'CREDIT', 1_000_000n),
      ],
    });
  });

  it('balances across more than two postings', () => {
    expect(() =>
      record([
        posting('a', 'DEBIT', 8_000n),
        posting('b', 'CREDIT', 5_000n),
        posting('c', 'CREDIT', 3_000n),
      ]),
    ).not.toThrow();
  });

  it('refuses debits that differ from credits', () => {
    expect(() =>
      record([posting('funding', 'DEBIT', 1_000_000n), posting('customer', 'CREDIT', 999_999n)]),
    ).toThrow(UnbalancedJournalEntry);
  });

  it('refuses fewer than two postings', () => {
    expect(() => record([])).toThrow(UnbalancedJournalEntry);
    expect(() => record([posting('customer', 'CREDIT', 100n)])).toThrow(UnbalancedJournalEntry);
  });

  it('refuses postings that are not positive', () => {
    expect(() => record([posting('a', 'DEBIT', 0n), posting('b', 'CREDIT', 0n)])).toThrow(
      UnbalancedJournalEntry,
    );
    expect(() => record([posting('a', 'DEBIT', -100n), posting('b', 'CREDIT', -100n)])).toThrow(
      UnbalancedJournalEntry,
    );
  });

  it('keeps its postings to itself: changing the input changes nothing', () => {
    const postings = [posting('a', 'DEBIT', 100n), posting('b', 'CREDIT', 100n)];
    const entry = record(postings);

    postings.pop();

    expect(entry.state.postings).toHaveLength(2);
  });
});
