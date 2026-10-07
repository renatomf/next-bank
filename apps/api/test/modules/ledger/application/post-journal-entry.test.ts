import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { PostJournalEntry } from '../../../../src/modules/ledger/application/post-journal-entry.ts';
import { InsufficientFunds } from '../../../../src/modules/ledger/domain/errors.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FUNDING_ID, InMemoryLedger, tx } from './fakes.ts';

// Posting a journal entry (ADR 0005, ADR 0007; database.md, section 7): the
// entry and every customer balance change together, or nothing does.
const NOW = new Date('2026-10-07T12:00:00.000Z');

function setup() {
  const ledger = new InMemoryLedger();
  ledger.addCustomer('ledger-a', 'account-a', 10_000n);
  ledger.addCustomer('ledger-b', 'account-b', 0n);
  const post = new PostJournalEntry({
    repositories: ledger,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  });
  return { ledger, post };
}

function transfer(cents: bigint) {
  return {
    kind: 'PIX_INTERNAL' as const,
    referenceType: 'PIX_TRANSFER',
    referenceId: 'pix-1',
    postings: [
      {
        ledgerAccountId: 'ledger-a',
        direction: 'DEBIT' as const,
        amount: Money.of(cents),
        counterpartyName: 'Bruno Teste',
        counterpartyDocumentMasked: '***.842.000-**',
      },
      {
        ledgerAccountId: 'ledger-b',
        direction: 'CREDIT' as const,
        amount: Money.of(cents),
        counterpartyName: 'Ana Teste',
        counterpartyDocumentMasked: '***.123.000-**',
      },
    ],
  };
}

describe('PostJournalEntry', () => {
  it('records the entry and moves both customer balances', async () => {
    const { ledger, post } = setup();

    const entryId = await post.execute(tx, transfer(8_000n));

    expect(ledger.balanceOf('ledger-a')).toBe(2_000n);
    expect(ledger.balanceOf('ledger-b')).toBe(8_000n);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      id: entryId,
      kind: 'PIX_INTERNAL',
      referenceType: 'PIX_TRANSFER',
      referenceId: 'pix-1',
      createdAt: NOW,
    });
    expect(ledger.entries[0]?.postings.map((p) => p.id)).toEqual(['id-2', 'id-3']);
  });

  it('counts each balance change in the account version', async () => {
    const { ledger, post } = setup();

    await post.execute(tx, transfer(1_000n));

    expect(ledger.accounts.get('ledger-a')?.version).toBe(1);
    expect(ledger.accounts.get('ledger-b')?.version).toBe(1);
  });

  it('refuses a debit above the balance and records nothing (InsufficientFunds)', async () => {
    const { ledger, post } = setup();

    await expect(post.execute(tx, transfer(10_001n))).rejects.toBeInstanceOf(InsufficientFunds);

    expect(ledger.balanceOf('ledger-a')).toBe(10_000n);
    expect(ledger.balanceOf('ledger-b')).toBe(0n);
    expect(ledger.entries).toEqual([]);
  });

  it('locks each account once, however many postings it has', async () => {
    const { ledger, post } = setup();
    const entry = transfer(1_000n);

    await post.execute(tx, {
      ...entry,
      postings: [...entry.postings, ...entry.postings],
    });

    expect(ledger.locks).toEqual([['ledger-a', 'ledger-b']]);
    expect(ledger.balanceOf('ledger-a')).toBe(8_000n);
  });

  it('never changes a system account balance', async () => {
    const { ledger, post } = setup();

    await post.execute(tx, {
      kind: 'FUNDING',
      referenceType: 'ACCOUNT',
      referenceId: 'account-b',
      postings: [
        {
          ledgerAccountId: FUNDING_ID,
          direction: 'DEBIT',
          amount: Money.of(500n),
          counterpartyName: null,
          counterpartyDocumentMasked: null,
        },
        {
          ledgerAccountId: 'ledger-b',
          direction: 'CREDIT',
          amount: Money.of(500n),
          counterpartyName: 'next bank',
          counterpartyDocumentMasked: null,
        },
      ],
    });

    expect(ledger.balanceOf(FUNDING_ID)).toBe(0n);
    expect(ledger.accounts.get(FUNDING_ID)?.version).toBe(0);
    expect(ledger.balanceOf('ledger-b')).toBe(500n);
  });

  it('fails on an account that does not exist, a bug in the caller', async () => {
    const { ledger, post } = setup();
    const entry = transfer(1_000n);

    await expect(
      post.execute(tx, {
        ...entry,
        postings: entry.postings.map((p) => ({ ...p, ledgerAccountId: 'ledger-ghost' })),
      }),
    ).rejects.toThrow(/ledger-ghost/);
    expect(ledger.entries).toEqual([]);
  });
});
