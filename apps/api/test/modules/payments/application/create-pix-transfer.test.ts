import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CreatePixTransfer,
  type CreatePixTransferInput,
} from '../../../../src/modules/payments/application/create-pix-transfer.ts';
import {
  AccountBlocked,
  IdempotencyKeyReused,
  InsufficientFunds,
  LimitExceeded,
  PixKeyNotFound,
  SamePayerAndPayee,
  TooManyKeyLookups,
} from '../../../../src/modules/payments/domain/errors.ts';
import { InMemoryKeyLookupQuota } from '../../../../src/modules/payments/infrastructure/in-memory-key-lookup-quota.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeFingerprint, FakeKeyProtector, FakeUnitOfWork, twoCustomers } from './fakes.ts';

// Creating a Pix (domain-model.md 3.4, 4 and 7; ADR 0007; PIX-02, PIX-04):
// it is born awaiting the PIN after the early checks, once per idempotency
// key. 15:00 UTC is 12:00 in São Paulo, under the day limit.
const NOW = new Date('2026-10-07T15:00:00.000Z');
const IDEMPOTENCY_KEY = randomUUID();

function setup() {
  const world = twoCustomers();
  const quota = new InMemoryKeyLookupQuota();
  const clock = new FixedClock(NOW);
  const create = new CreatePixTransfer({
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    protector: new FakeKeyProtector(),
    fingerprint: new FakeFingerprint(),
    accounts: world.accounts,
    identity: world.identity,
    ledger: world.ledger,
    quota,
    clock,
    ids: new SequentialIds(),
  });
  return { ...world, clock, create };
}

function input(overrides: Partial<CreatePixTransferInput> = {}): CreatePixTransferInput {
  return {
    userId: 'user-a',
    sessionId: 'session-a',
    idempotencyKey: IDEMPOTENCY_KEY,
    key: { type: 'CPF', value: '123.456.789-09' },
    amountCents: 8_000,
    description: 'Almoço',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('CreatePixTransfer', () => {
  it('creates the Pix awaiting the PIN and answers 201 with what the client may see', async () => {
    const { repositories, create } = setup();

    const result = await create.execute(input());

    expect(result).toEqual({
      status: 201,
      body: {
        id: 'id-1',
        status: 'AWAITING_AUTH',
        amount: { amount: 8_000, currency: 'BRL' },
        description: 'Almoço',
        payee: {
          name: 'Marina Costa',
          documentMasked: '***.456.789-**',
          keyType: 'CPF',
          keyMasked: '***.456.789-**',
        },
        endToEndId: null,
        failureReason: null,
        createdAt: '2026-10-07T15:00:00.000Z',
        expiresAt: '2026-10-07T15:10:00.000Z',
        completedAt: null,
      },
    });
    expect(repositories.transfers).toHaveLength(1);
    expect(repositories.transfers[0]).toMatchObject({
      payerAccountId: 'account-a',
      payee: { accountId: 'account-b' },
      amount: Money.of(8_000n),
    });
  });

  it('records PIX_CREATED with the session and request, without the key value', async () => {
    const { repositories, create } = setup();

    await create.execute(input());

    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIX_CREATED',
        actorType: 'USER',
        actorId: 'user-a',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'id-1',
        requestId: 'req-1',
        metadata: { sessionId: 'session-a', amountCents: 8_000, keyType: 'CPF' },
      }),
    ]);
    expect(JSON.stringify(repositories.auditEvents)).not.toContain('12345678909');
  });

  // PIX-02: the same request again gets the same answer and no second Pix.
  it('answers a repeated request with the stored response and creates nothing more', async () => {
    const { repositories, create } = setup();
    const first = await create.execute(input());

    const again = await create.execute(input());

    expect(again).toEqual(first);
    expect(repositories.transfers).toHaveLength(1);
  });

  it('refuses the same key with another request (IdempotencyKeyReused)', async () => {
    const { repositories, create } = setup();
    await create.execute(input());

    await expect(create.execute(input({ amountCents: 9_000 }))).rejects.toThrow(
      IdempotencyKeyReused,
    );
    expect(repositories.transfers).toHaveLength(1);
  });

  it('keeps keys per customer: another customer may use the same key', async () => {
    const { accounts, ledger, create } = setup();
    accounts.accounts.set('account-c', {
      id: 'account-c',
      holderUserId: 'user-c',
      status: 'ACTIVE',
    });
    ledger.balances.set('account-c', Money.zero());

    await expect(create.execute(input({ userId: 'user-c' }))).rejects.toThrow(InsufficientFunds);
  });

  it('refuses an amount above the available balance (InsufficientFunds)', async () => {
    const { repositories, create } = setup();

    await expect(create.execute(input({ amountCents: 10_001 }))).rejects.toThrow(InsufficientFunds);
    expect(repositories.transfers).toEqual([]);
  });

  it('refuses an amount above the limit in force (LimitExceeded)', async () => {
    const { ledger, create } = setup();
    ledger.balances.set('account-a', Money.of(1_000_000n));

    await expect(create.execute(input({ amountCents: 500_001 }))).rejects.toThrow(LimitExceeded);
  });

  it('refuses a Pix from a blocked account (AccountBlocked)', async () => {
    const { accounts, create } = setup();
    accounts.accounts.set('account-a', {
      id: 'account-a',
      holderUserId: 'user-a',
      status: 'BLOCKED',
    });

    await expect(create.execute(input())).rejects.toThrow(AccountBlocked);
  });

  it('refuses a Pix to the payer itself (SamePayerAndPayee)', async () => {
    const { repositories, identity, create } = setup();
    repositories.addKey('CPF', '11144477735', { accountId: 'account-a', masked: '***.444.777-**' });
    identity.people.set('user-a', { name: 'Ana Souza', documentMasked: '***.444.777-**' });

    await expect(
      create.execute(input({ key: { type: 'CPF', value: '111.444.777-35' } })),
    ).rejects.toThrow(SamePayerAndPayee);
  });

  it('finds no key for an unknown CPF (PixKeyNotFound)', async () => {
    const { create } = setup();

    await expect(
      create.execute(input({ key: { type: 'CPF', value: '111.444.777-35' } })),
    ).rejects.toThrow(PixKeyNotFound);
  });

  // PIX-07: the answer names the payee, so creating spends the lookup quota too.
  it('spends the lookup quota, twice for a missing key', async () => {
    const { create } = setup();
    for (let i = 0; i < 15; i++) {
      await expect(
        create.execute(
          input({
            idempotencyKey: `key-${String(i)}`,
            key: { type: 'CPF', value: '111.444.777-35' },
          }),
        ),
      ).rejects.toThrow(PixKeyNotFound);
    }

    await expect(create.execute(input({ idempotencyKey: 'key-last' }))).rejects.toThrow(
      TooManyKeyLookups,
    );
  });
});
