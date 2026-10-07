import { describe, expect, it } from 'vitest';
import { Account, accountNumberFrom } from '../../../../src/modules/accounts/domain/account.ts';

// Current account (domain-model.md 3.2): branch 0001, a sequential number
// with a mod-11 check digit, and no balance (that is the ledger's job).
const NOW = new Date('2026-10-07T12:00:00.000Z');

describe('account number', () => {
  for (const [sequence, expected] of [
    [100000, '100000-4'],
    [100001, '100001-2'],
    [654321, '654321-9'],
    // Remainder 0 gives 11 and remainder 1 gives 10: both become 0.
    [123456, '123456-0'],
    [100008, '100008-0'],
  ] as const) {
    it(`numbers sequence ${String(sequence)} as ${expected}`, () => {
      expect(accountNumberFrom(sequence)).toBe(expected);
    });
  }

  it('refuses a sequence outside six digits', () => {
    expect(() => accountNumberFrom(99_999)).toThrow(/six digits/);
    expect(() => accountNumberFrom(1_000_000)).toThrow(/six digits/);
    expect(() => accountNumberFrom(100_000.5)).toThrow(/six digits/);
  });
});

describe('Account', () => {
  it('opens active, in branch 0001, for its holder', () => {
    const account = Account.open({
      id: 'account-1',
      holderUserId: 'user-1',
      sequence: 100000,
      now: NOW,
    });

    expect(account.state).toEqual({
      id: 'account-1',
      holderUserId: 'user-1',
      branch: '0001',
      number: '100000-4',
      status: 'ACTIVE',
      openedAt: NOW,
      updatedAt: NOW,
    });
  });

  it('restores a stored account as it was', () => {
    const state = {
      id: 'account-2',
      holderUserId: 'user-2',
      branch: '0001',
      number: '654321-9',
      status: 'BLOCKED',
      openedAt: NOW,
      updatedAt: NOW,
    } as const;

    expect(Account.restore(state).state).toEqual(state);
  });
});
