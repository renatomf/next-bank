import { describe, expect, it } from 'vitest';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { GetMyAccount } from '../../../../src/modules/accounts/application/get-my-account.ts';
import { FakeLedger, InMemoryAccounts } from './fakes.ts';

// The caller's own current account with its available balance (week 4 plan,
// D5; READ-01): the account always comes from the authenticated user, never
// from an id the client sends.
const NOW = new Date('2026-10-07T12:00:00.000Z');

function setup() {
  const store = new InMemoryAccounts();
  store.accounts.push({
    id: 'account-1',
    holderUserId: 'user-1',
    branch: '0001',
    number: '100000-4',
    status: 'ACTIVE',
    openedAt: NOW,
    updatedAt: NOW,
  });
  const ledger = new FakeLedger();
  ledger.balances.set('account-1', Money.of(1_000_000n));
  const getMyAccount = new GetMyAccount({ unitOfWork: store, repositories: store, ledger });
  return { store, ledger, getMyAccount };
}

describe('GetMyAccount', () => {
  it("returns the caller's account with the available balance", async () => {
    const { getMyAccount } = setup();

    await expect(getMyAccount.execute('user-1')).resolves.toEqual({
      branch: '0001',
      number: '100000-4',
      status: 'ACTIVE',
      availableBalance: Money.of(1_000_000n),
    });
  });

  it('answers NotFound when the caller has no account', async () => {
    const { getMyAccount } = setup();

    await expect(getMyAccount.execute('user-without-account')).rejects.toBeInstanceOf(NotFound);
  });

  it('fails loudly when the account has no ledger account, a broken invariant', async () => {
    const { ledger, getMyAccount } = setup();
    ledger.balances.clear();

    await expect(getMyAccount.execute('user-1')).rejects.toThrow(/account-1/);
  });
});
