import { describe, expect, it } from 'vitest';
import { OpenAccount } from '../../../../src/modules/accounts/application/open-account.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeLedger, InMemoryAccounts, tx } from './fakes.ts';

// Opening the current account (domain-model.md 3.2 and 8; decision D2): the
// account, its ledger account and the audit event, all in the caller's
// transaction.
const NOW = new Date('2026-10-07T12:00:00.000Z');

function setup() {
  const store = new InMemoryAccounts();
  const ledger = new FakeLedger();
  const openAccount = new OpenAccount({
    repositories: store,
    ledger,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  });
  return { store, ledger, openAccount };
}

const input = { holderUserId: 'user-1', requestId: 'req-12345678' };

describe('OpenAccount', () => {
  it('opens an active account numbered from the sequence', async () => {
    const { store, openAccount } = setup();

    const accountId = await openAccount.execute(tx, input);

    expect(accountId).toBe('id-1');
    expect(store.accounts).toEqual([
      {
        id: 'id-1',
        holderUserId: 'user-1',
        branch: '0001',
        number: '100000-4',
        status: 'ACTIVE',
        openedAt: NOW,
        updatedAt: NOW,
      },
    ]);
  });

  it('opens its ledger account in the same transaction (D2)', async () => {
    const { ledger, openAccount } = setup();

    await openAccount.execute(tx, input);

    expect(ledger.opened).toEqual([{ tx, accountId: 'id-1' }]);
  });

  it('records ACCOUNT_OPENED with the request id and no personal data', async () => {
    const { store, openAccount } = setup();

    await openAccount.execute(tx, input);

    expect(store.auditEvents).toEqual([
      {
        id: 'id-2',
        occurredAt: NOW,
        actorType: 'USER',
        actorId: 'user-1',
        action: 'ACCOUNT_OPENED',
        subjectType: 'ACCOUNT',
        subjectId: 'id-1',
        requestId: 'req-12345678',
        metadata: {},
      },
    ]);
  });

  it('gives each account the next number', async () => {
    const { store, openAccount } = setup();

    await openAccount.execute(tx, input);
    await openAccount.execute(tx, { ...input, holderUserId: 'user-2' });

    expect(store.accounts.map((a) => a.number)).toEqual(['100000-4', '100001-2']);
  });
});
