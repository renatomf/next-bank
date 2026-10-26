import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { CustomerLedgerAccounts } from '../../../../src/modules/ledger/application/customer-ledger-accounts.ts';
import { PostJournalEntry } from '../../../../src/modules/ledger/application/post-journal-entry.ts';
import { InsufficientFunds } from '../../../../src/modules/ledger/domain/errors.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import {
  BACEN_SETTLEMENT_ID,
  FUNDING_ID,
  InMemoryLedger,
  PIX_CLEARING_ID,
  topUpLedgerIdOf,
  tx,
} from './fakes.ts';

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

  // v1.1.0 plan, task 5: the money leaves for the operator's system account;
  // the customer's posting keeps the operator and the masked number, which is
  // what the statement shows (READ-02).
  const TOP_UP = {
    topUpId: 'top-up-1',
    accountId: 'account-a',
    operatorId: 'pulso-celular',
    amount: Money.of(3_000n),
    counterparty: { name: 'Pulso Celular', documentMasked: '(11) *****-0001' },
  };

  it('posts a top-up from the customer to the operator, referencing the top-up', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(10_000n) });

    await accounts.topUp(tx, TOP_UP);

    expect(ledger.balanceOf('id-1')).toBe(7_000n);
    const topUp = ledger.entries.find((entry) => entry.kind === 'TOP_UP');
    expect(topUp).toMatchObject({ referenceType: 'TOP_UP', referenceId: 'top-up-1' });
    expect(topUp?.postings).toEqual([
      expect.objectContaining({
        ledgerAccountId: 'id-1',
        direction: 'DEBIT',
        amount: Money.of(3_000n),
        counterpartyName: 'Pulso Celular',
        counterpartyDocumentMasked: '(11) *****-0001',
      }),
      expect.objectContaining({
        ledgerAccountId: topUpLedgerIdOf('pulso-celular'),
        direction: 'CREDIT',
        amount: Money.of(3_000n),
        counterpartyName: null,
        counterpartyDocumentMasked: null,
      }),
    ]);
  });

  it('refuses a top-up above the available balance and writes nothing (InsufficientFunds)', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(1_000n) });

    await expect(accounts.topUp(tx, TOP_UP)).rejects.toThrow(InsufficientFunds);
    expect(ledger.entries.filter((entry) => entry.kind === 'TOP_UP')).toEqual([]);
    expect(ledger.balanceOf('id-1')).toBe(1_000n);
  });

  it('locks the customer ledger account on its own, before the day total is read', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');

    await accounts.lockCustomer(tx, 'account-a');

    expect(ledger.locks.at(-1)).toEqual(['id-1']);
  });

  it('fails a top-up to an operator without a ledger account, a bug in the caller', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(10_000n) });

    await expect(accounts.topUp(tx, { ...TOP_UP, operatorId: 'vivo' })).rejects.toThrow(/vivo/);
    expect(ledger.entries.filter((entry) => entry.kind === 'TOP_UP')).toEqual([]);
  });

  // v1.2.0 plan, task 3: an external Pix leaves for system:pix_clearing,
  // where it waits for the SPI (domain-model.md, section 5); only the
  // customer's posting keeps the payee, for the statement.
  const EXTERNAL = {
    transferId: 'pix-ext-1',
    payerAccountId: 'account-a',
    amount: Money.of(5_000n),
    payee: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
  };

  it('posts an external Pix from the customer to the clearing account', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(10_000n) });

    await accounts.sendPixExternal(tx, EXTERNAL);

    expect(ledger.balanceOf('id-1')).toBe(5_000n);
    const entry = ledger.entries.find((e) => e.kind === 'PIX_EXTERNAL');
    expect(entry).toMatchObject({ referenceType: 'PIX_TRANSFER', referenceId: 'pix-ext-1' });
    expect(entry?.postings).toEqual([
      expect.objectContaining({
        ledgerAccountId: 'id-1',
        direction: 'DEBIT',
        counterpartyName: 'Clara Aurora Teixeira',
        counterpartyDocumentMasked: '***.407.256-**',
      }),
      expect.objectContaining({
        ledgerAccountId: PIX_CLEARING_ID,
        direction: 'CREDIT',
        counterpartyName: null,
        counterpartyDocumentMasked: null,
      }),
    ]);
  });

  it('refuses an external Pix above the available balance and writes nothing', async () => {
    const { ledger, accounts } = setup();
    await accounts.open(tx, 'account-a');
    await accounts.fund(tx, { accountId: 'account-a', amount: Money.of(1_000n) });

    await expect(accounts.sendPixExternal(tx, EXTERNAL)).rejects.toThrow(InsufficientFunds);
    expect(ledger.entries.filter((e) => e.kind === 'PIX_EXTERNAL')).toEqual([]);
  });

  // v1.2.0 plan, task 4 (domain-model.md, section 6): the SPI's answer moves
  // the money out of system:pix_clearing, once per Pix.
  async function sent() {
    const world = setup();
    await world.accounts.open(tx, 'account-a');
    await world.accounts.fund(tx, { accountId: 'account-a', amount: Money.of(10_000n) });
    await world.accounts.sendPixExternal(tx, EXTERNAL);
    return world;
  }

  it('settles an external Pix from the clearing account to the settlement account', async () => {
    const { ledger, accounts } = await sent();

    await accounts.settlePixExternal(tx, { transferId: 'pix-ext-1', amount: Money.of(5_000n) });

    const entry = ledger.entries.find((e) => e.kind === 'PIX_EXTERNAL_SETTLEMENT');
    expect(entry).toMatchObject({ referenceType: 'PIX_TRANSFER', referenceId: 'pix-ext-1' });
    expect(entry?.postings).toEqual([
      expect.objectContaining({ ledgerAccountId: PIX_CLEARING_ID, direction: 'DEBIT' }),
      expect.objectContaining({ ledgerAccountId: BACEN_SETTLEMENT_ID, direction: 'CREDIT' }),
    ]);
    // The customer's balance does not move again: the money left at the authorization.
    expect(ledger.balanceOf('id-1')).toBe(5_000n);
  });

  it('refunds an external Pix from the clearing account to the customer', async () => {
    const { ledger, accounts } = await sent();

    await accounts.refundPixExternal(tx, EXTERNAL);

    expect(ledger.balanceOf('id-1')).toBe(10_000n);
    const entry = ledger.entries.find((e) => e.kind === 'PIX_EXTERNAL_REFUND');
    expect(entry).toMatchObject({ referenceType: 'PIX_TRANSFER', referenceId: 'pix-ext-1' });
    expect(entry?.postings).toEqual([
      expect.objectContaining({
        ledgerAccountId: PIX_CLEARING_ID,
        direction: 'DEBIT',
        counterpartyName: null,
      }),
      expect.objectContaining({
        ledgerAccountId: 'id-1',
        direction: 'CREDIT',
        counterpartyName: 'Clara Aurora Teixeira',
        counterpartyDocumentMasked: '***.407.256-**',
      }),
    ]);
    expect(ledger.locks.at(-1)).toEqual(['id-1']);
  });

  it('fails to settle or refund for an account that was never opened, a bug', async () => {
    const { accounts } = await sent();

    await expect(
      accounts.refundPixExternal(tx, { ...EXTERNAL, payerAccountId: 'account-unknown' }),
    ).rejects.toThrow(/pix-ext-1/);
  });

  it('fails to fund an account that was never opened, a bug in the caller', async () => {
    const { ledger, accounts } = setup();

    await expect(
      accounts.fund(tx, { accountId: 'account-unknown', amount: Money.of(100n) }),
    ).rejects.toThrow(/account-unknown/);
    expect(ledger.entries).toEqual([]);
  });
});
