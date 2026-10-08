import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { CustomerLedgerAccounts } from '../../../../src/modules/ledger/application/customer-ledger-accounts.ts';
import { PostJournalEntry } from '../../../../src/modules/ledger/application/post-journal-entry.ts';
import { InsufficientFunds } from '../../../../src/modules/ledger/domain/errors.ts';
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

  // domain-model.md 6: debit the payer, credit the payee; each side keeps who was on
  // the other, which is what the statement shows (section 8.1).
  it('posts an internal Pix from payer to payee, referencing the transfer', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.open(tx, 'account-b');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(10_000n) });

    await accounts.transferPix(tx, {
      transferId: 'pix-1',
      payerAccountId: 'account-a',
      payeeAccountId: 'account-b',
      amount: Money.of(8_000n),
      payer: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
      payee: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
    });

    expect(ledger.balanceOf('id-1')).toBe(2_000n);
    expect(ledger.balanceOf('id-2')).toBe(8_000n);
    const pix = ledger.entries.find((entry) => entry.kind === 'PIX_INTERNAL');
    expect(pix).toMatchObject({ referenceType: 'PIX_TRANSFER', referenceId: 'pix-1' });
    expect(pix?.postings).toEqual([
      expect.objectContaining({
        ledgerAccountId: 'id-1',
        direction: 'DEBIT',
        amount: Money.of(8_000n),
        counterpartyName: 'Marina Costa',
        counterpartyDocumentMasked: '***.456.789-**',
      }),
      expect.objectContaining({
        ledgerAccountId: 'id-2',
        direction: 'CREDIT',
        amount: Money.of(8_000n),
        counterpartyName: 'Ana Souza',
        counterpartyDocumentMasked: '***.444.777-**',
      }),
    ]);
  });

  it('refuses a Pix above the available balance and writes nothing (InsufficientFunds)', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.open(tx, 'account-b');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(5_000n) });

    await expect(
      accounts.transferPix(tx, {
        transferId: 'pix-1',
        payerAccountId: 'account-a',
        payeeAccountId: 'account-b',
        amount: Money.of(8_000n),
        payer: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
        payee: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
      }),
    ).rejects.toThrow(InsufficientFunds);
    expect(ledger.entries.filter((entry) => entry.kind === 'PIX_INTERNAL')).toEqual([]);
    expect(ledger.balanceOf('id-1')).toBe(5_000n);
  });

  it('fails to fund an account that was never opened, a bug in the caller', async () => {
    const { ledger, accounts } = setup();

    await expect(
      accounts.fund(tx, { accountId: 'account-unknown', amount: Money.of(100n) }),
    ).rejects.toThrow(/account-unknown/);
    expect(ledger.entries).toEqual([]);
  });
});
