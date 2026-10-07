import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { CustomerLedgerAccounts } from '../../../../src/modules/ledger/application/customer-ledger-accounts.ts';
import { PostJournalEntry } from '../../../../src/modules/ledger/application/post-journal-entry.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FUNDING_ID, InMemoryLedger, tx } from './fakes.ts';

// What the other contexts ask of the ledger about a customer account
// (domain-model.md, sections 5, 6 and 8): open it, fund it, read its balance.
const NOW = new Date('2026-10-07T12:00:00.000Z');

function setup() {
  const ledger = new InMemoryLedger();
  const clock = new FixedClock(NOW);
  const ids = new SequentialIds();
  const accounts = new CustomerLedgerAccounts({
    repositories: ledger,
    clock,
    ids,
    postJournalEntry: new PostJournalEntry({ repositories: ledger, clock, ids }),
  });
  return { ledger, accounts };
}

describe('CustomerLedgerAccounts', () => {
  it('opens the ledger account of a current account, coded by its id', async () => {
    const { ledger, accounts } = setup();

    await accounts.open(tx, 'account-1');

    expect(ledger.accounts.get('id-1')).toEqual({
      id: 'id-1',
      code: 'customer:account-1',
      kind: 'CUSTOMER',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: NOW,
    });
  });

  it('funds it from system:funding, referencing the account (D3)', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-1');

    await accounts.fund(tx, { accountId: 'account-1', amount: Money.of(1_000_000n) });

    expect(ledger.balanceOf('id-1')).toBe(1_000_000n);
    const entry = ledger.entries[0];
    expect(entry).toMatchObject({
      kind: 'FUNDING',
      referenceType: 'ACCOUNT',
      referenceId: 'account-1',
    });
    expect(entry?.postings).toEqual([
      expect.objectContaining({
        ledgerAccountId: FUNDING_ID,
        direction: 'DEBIT',
        amount: Money.of(1_000_000n),
        counterpartyName: null,
      }),
      // What the customer's statement shows: "Depósito inicial" from next bank.
      expect.objectContaining({
        ledgerAccountId: 'id-1',
        direction: 'CREDIT',
        amount: Money.of(1_000_000n),
        counterpartyName: 'next bank',
        counterpartyDocumentMasked: null,
      }),
    ]);
  });

  it('reads the available balance of an account', async () => {
    const { accounts } = setup();
    await accounts.open(tx, 'account-1');
    await accounts.fund(tx, { accountId: 'account-1', amount: Money.of(2_500n) });

    expect(await accounts.availableBalance(tx, 'account-1')).toEqual(Money.of(2_500n));
  });

  it('has no balance for an account without a ledger account', async () => {
    const { accounts } = setup();

    expect(await accounts.availableBalance(tx, 'account-unknown')).toBeNull();
  });

  it('fails to fund an account that was never opened, a bug in the caller', async () => {
    const { ledger, accounts } = setup();

    await expect(
      accounts.fund(tx, { accountId: 'account-unknown', amount: Money.of(100n) }),
    ).rejects.toThrow(/account-unknown/);
    expect(ledger.entries).toEqual([]);
  });
});
