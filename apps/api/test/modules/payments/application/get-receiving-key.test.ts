import { describe, expect, it } from 'vitest';
import { GetReceivingKey } from '../../../../src/modules/payments/application/get-receiving-key.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import {
  FakeAccounts,
  FakeKeyProtector,
  FakePaymentsRepositories,
  FakeUnitOfWork,
  SequentialRandomUuids,
} from './fakes.ts';

// The key a customer shares to receive by QR Code (v1.1.0 plan, task 3; D2):
// one random key per account, created the first time, never the CPF (PIX-12).
const NOW = new Date('2026-10-14T12:00:00.000Z');
const FIRST_RANDOM = '00000000-0000-4000-8000-000000000001';

function setup() {
  const repositories = new FakePaymentsRepositories();
  const accounts = new FakeAccounts();
  accounts.accounts.set('account-a', { id: 'account-a', holderUserId: 'user-a', status: 'ACTIVE' });
  accounts.accounts.set('account-b', { id: 'account-b', holderUserId: 'user-b', status: 'ACTIVE' });
  const unitOfWork = new FakeUnitOfWork();
  const getReceivingKey = new GetReceivingKey({
    unitOfWork,
    repositories,
    protector: new FakeKeyProtector(),
    accounts,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    randomKeys: new SequentialRandomUuids(),
  });
  return { repositories, unitOfWork, getReceivingKey };
}

describe('GetReceivingKey', () => {
  it("creates a random key for the caller's account the first time, in one transaction", async () => {
    const { repositories, unitOfWork, getReceivingKey } = setup();

    const key = await getReceivingKey.execute({ customerId: 'user-a' });

    expect(key).toEqual({
      key: FIRST_RANDOM,
      keyMasked: '0000****-****-****-****-********0001',
    });
    expect(repositories.offeredRandomKeys).toEqual([
      {
        id: 'id-1',
        accountId: 'account-a',
        type: 'RANDOM',
        value: FIRST_RANDOM,
        masked: '0000****-****-****-****-********0001',
        createdAt: NOW,
      },
    ]);
    expect(unitOfWork.runs).toBe(1);
  });

  it('stores the key only sealed (API-06)', async () => {
    const { repositories, getReceivingKey } = setup();

    await getReceivingKey.execute({ customerId: 'user-a' });

    const stored = repositories.randomKeys.get('account-a');
    expect(new TextDecoder().decode(stored?.ciphertext)).toBe(`sealed(RANDOM:${FIRST_RANDOM})`);
  });

  it('gives back the same key on every later call, without a second one', async () => {
    const { repositories, getReceivingKey } = setup();
    const first = await getReceivingKey.execute({ customerId: 'user-a' });

    const again = await getReceivingKey.execute({ customerId: 'user-a' });

    expect(again).toEqual(first);
    expect(repositories.randomKeys.size).toBe(1);
  });

  // Two "Receber" at once: the one that loses the insert reads the winner's key.
  it('gives back the key another request just created', async () => {
    const { repositories, getReceivingKey } = setup();
    const winner = '7d9f3c2a-1b4e-4c8d-9a6f-5e2b1c0d3a4f';
    repositories.randomKeys.set('account-a', {
      ciphertext: new TextEncoder().encode(`sealed(RANDOM:${winner})`),
      keyVersion: 1,
      masked: '7d9f****-****-****-****-********3a4f',
    });

    const key = await getReceivingKey.execute({ customerId: 'user-a' });

    expect(key).toEqual({ key: winner, keyMasked: '7d9f****-****-****-****-********3a4f' });
  });

  // IDOR: the account always comes from the token (PIX-01).
  it("never gives one customer another customer's key", async () => {
    const { getReceivingKey } = setup();

    const ana = await getReceivingKey.execute({ customerId: 'user-a' });
    const bruno = await getReceivingKey.execute({ customerId: 'user-b' });

    expect(bruno.key).not.toBe(ana.key);
    await expect(getReceivingKey.execute({ customerId: 'user-a' })).resolves.toEqual(ana);
  });

  // Every customer gets an account at registration: anything else is a bug.
  it('fails loudly for a customer without an account', async () => {
    const { getReceivingKey } = setup();

    await expect(getReceivingKey.execute({ customerId: 'user-x' })).rejects.toThrow(
      'Customer without an account',
    );
  });
});
