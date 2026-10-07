import { describe, expect, it } from 'vitest';
import { Money } from '../../../../src/shared/domain/money.ts';
import { InsufficientFunds } from '../../../../src/modules/ledger/domain/errors.ts';
import { LedgerAccount } from '../../../../src/modules/ledger/domain/ledger-account.ts';

// Ledger account (domain-model.md 3.3): balance = credits − debits. A
// customer never goes below zero; a system account has no materialized
// balance (database.md 5.3).
const NOW = new Date('2026-10-07T12:00:00.000Z');

function customerWith(cents: bigint): LedgerAccount {
  return LedgerAccount.restore({
    id: 'ledger-1',
    code: 'customer:account-1',
    kind: 'CUSTOMER',
    postedBalance: Money.of(cents),
    availableBalance: Money.of(cents),
    version: 3,
    createdAt: NOW,
  });
}

describe('LedgerAccount', () => {
  it('opens a customer account with zero balances, coded by the account id', () => {
    const account = LedgerAccount.openCustomer({
      id: 'ledger-1',
      accountId: 'account-1',
      now: NOW,
    });

    expect(account.state).toEqual({
      id: 'ledger-1',
      code: 'customer:account-1',
      kind: 'CUSTOMER',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: NOW,
    });
  });

  it('raises both balances on a credit and counts the change', () => {
    const account = customerWith(10_000n);

    account.post('CREDIT', Money.of(2_500n));

    expect(account.state.postedBalance).toEqual(Money.of(12_500n));
    expect(account.state.availableBalance).toEqual(Money.of(12_500n));
    expect(account.state.version).toBe(4);
  });

  it('lowers both balances on a debit', () => {
    const account = customerWith(10_000n);

    account.post('DEBIT', Money.of(8_000n));

    expect(account.state.postedBalance).toEqual(Money.of(2_000n));
    expect(account.state.availableBalance).toEqual(Money.of(2_000n));
    expect(account.state.version).toBe(4);
  });

  it('spends the whole balance down to zero', () => {
    const account = customerWith(8_000n);

    account.post('DEBIT', Money.of(8_000n));

    expect(account.state.availableBalance).toEqual(Money.zero());
  });

  it('refuses a debit above the available balance and changes nothing', () => {
    const account = customerWith(10_000n);

    expect(() => {
      account.post('DEBIT', Money.of(10_001n));
    }).toThrow(InsufficientFunds);
    expect(account.state.availableBalance).toEqual(Money.of(10_000n));
    expect(account.state.version).toBe(3);
  });

  it('never changes a system account: its balance is the sum of its postings', () => {
    const funding = LedgerAccount.restore({
      id: 'ledger-funding',
      code: 'system:funding',
      kind: 'SYSTEM',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: NOW,
    });

    funding.post('DEBIT', Money.of(1_000_000n));

    expect(funding.state.postedBalance).toEqual(Money.zero());
    expect(funding.state.version).toBe(0);
  });

  it('accepts only positive amounts', () => {
    const account = customerWith(10_000n);

    expect(() => {
      account.post('CREDIT', Money.zero());
    }).toThrow(/positive/);
  });
});
