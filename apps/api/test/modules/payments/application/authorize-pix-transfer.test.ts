import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuthorizePixTransfer,
  type AuthorizePixTransferInput,
} from '../../../../src/modules/payments/application/authorize-pix-transfer.ts';
import {
  InvalidTransferState,
  PixAuthorizationRefused,
} from '../../../../src/modules/payments/domain/errors.ts';
import { IdempotencyKeyReused } from '../../../../src/shared/domain/idempotency-errors.ts';
import { PixTransfer } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeFingerprint, FakeUnitOfWork, FixedEndToEndIds, twoCustomers } from './fakes.ts';

// Authorizing a Pix with the PIN (domain-model.md 4 and 7; database.md 7;
// ADR 0007; PIX-01, PIX-02, PIX-05, PIX-08, PIX-09, PIX-10). 15:00 UTC is
// 12:00 in São Paulo, under the day limit.
const CREATED = new Date('2026-10-08T15:00:00.000Z');
const NOW = new Date('2026-10-08T15:01:00.000Z');
const E2E = 'E00000000202610081501a1B2c3D4e5F';

function setup(amountCents = 8_000n) {
  const world = twoCustomers();
  world.repositories.transfers.push(
    PixTransfer.create({
      id: 'pix-1',
      payerAccountId: 'account-a',
      payee: {
        accountId: 'account-b',
        name: 'Marina Costa',
        documentMasked: '***.456.789-**',
        keyType: 'CPF',
        keyMasked: '***.456.789-**',
      },
      amount: Money.of(amountCents),
      description: 'Almoço',
      now: CREATED,
    }).state,
  );
  const clock = new FixedClock(NOW);
  const authorize = new AuthorizePixTransfer({
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    fingerprint: new FakeFingerprint(),
    accounts: world.accounts,
    identity: world.identity,
    ledger: world.ledger,
    endToEndIds: new FixedEndToEndIds(),
    clock,
    ids: new SequentialIds(),
  });
  return { ...world, clock, authorize };
}

function input(overrides: Partial<AuthorizePixTransferInput> = {}): AuthorizePixTransferInput {
  return {
    userId: 'user-a',
    sessionId: 'session-a',
    transferId: 'pix-1',
    idempotencyKey: randomUUID(),
    pin: '2580',
    requestId: 'req-1',
    ...overrides,
  };
}

const actions = (events: { action: string }[]) => events.map((event) => event.action);

describe('AuthorizePixTransfer', () => {
  it('completes the Pix with the right PIN: one posting, the end-to-end id and 200', async () => {
    const { repositories, ledger, authorize } = setup();

    const result = await authorize.execute(input());

    expect(result).toMatchObject({
      status: 'COMPLETED',
      endToEndId: E2E,
      completedAt: NOW.toISOString(),
      failureReason: null,
    });
    expect(ledger.posted).toEqual([
      {
        transferId: 'pix-1',
        payerAccountId: 'account-a',
        payeeAccountId: 'account-b',
        amount: Money.of(8_000n),
        payer: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
        payee: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
      },
    ]);
    expect(repositories.transfers[0]).toMatchObject({ status: 'COMPLETED', authorizedAt: NOW });
  });

  // PIX-09: the trail ties the Pix to the session and request that authorized it.
  it('records PIX_COMPLETED with the session, the request and the end-to-end id', async () => {
    const { repositories, authorize } = setup();

    await authorize.execute(input());

    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIX_COMPLETED',
        actorId: 'user-a',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'pix-1',
        requestId: 'req-1',
        metadata: { sessionId: 'session-a', amountCents: 8_000, endToEndId: E2E },
      }),
    ]);
  });

  // Database.md 7: the accounts are read for share, so their status holds until the commit.
  it('reads both accounts locked for share before posting', async () => {
    const { accounts, authorize } = setup();

    await authorize.execute(input());

    expect(accounts.sharedLocks).toEqual([['account-a', 'account-b']]);
  });

  it('refuses a wrong PIN with the attempts left, keeping the Pix awaiting the PIN', async () => {
    const { repositories, identity, ledger, authorize } = setup();
    identity.pinOutcomes = [{ outcome: 'INCORRECT', remainingAttempts: 4 }];

    const failure = authorize.execute(input());

    await expect(failure).rejects.toThrow(PixAuthorizationRefused);
    await expect(failure).rejects.toMatchObject({
      code: 'PinIncorrect',
      details: { remainingAttempts: 4 },
    });
    expect(repositories.transfers[0]?.status).toBe('AWAITING_AUTH');
    expect(ledger.posted).toEqual([]);
  });

  // PIX-02 and D5: a lost answer about a wrong PIN comes back the same, without a new attempt.
  it('answers a repeated wrong-PIN request without checking the PIN again', async () => {
    const { identity, authorize } = setup();
    identity.pinOutcomes = [{ outcome: 'INCORRECT', remainingAttempts: 4 }];
    const request = input();
    await expect(authorize.execute(request)).rejects.toThrow(PixAuthorizationRefused);

    await expect(authorize.execute(request)).rejects.toMatchObject({ code: 'PinIncorrect' });
    expect(identity.pinsChecked).toHaveLength(1);
  });

  it('cancels the Pix when the PIN locks (domain-model.md 4)', async () => {
    const { repositories, identity, authorize } = setup();
    identity.pinOutcomes = [{ outcome: 'LOCKED', lockedUntil: new Date('2026-10-08T15:31:00Z') }];

    await expect(authorize.execute(input())).rejects.toMatchObject({ code: 'PinLocked' });
    expect(repositories.transfers[0]?.status).toBe('CANCELLED');
    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIX_CANCELLED',
        metadata: { sessionId: 'session-a', reason: 'PIN_LOCKED' },
      }),
    ]);
  });

  it('cancels the Pix when the PIN needs a reset with the password', async () => {
    const { repositories, identity, authorize } = setup();
    identity.pinOutcomes = [{ outcome: 'RESET_REQUIRED' }];

    await expect(authorize.execute(input())).rejects.toMatchObject({ code: 'PinResetRequired' });
    expect(repositories.transfers[0]?.status).toBe('CANCELLED');
  });

  it('cancels an expired Pix without checking the PIN (TransferExpired, PIX-08)', async () => {
    const { repositories, identity, clock, authorize } = setup();
    clock.current = new Date('2026-10-08T15:10:00.000Z');

    await expect(authorize.execute(input())).rejects.toMatchObject({ code: 'TransferExpired' });
    expect(repositories.transfers[0]?.status).toBe('CANCELLED');
    expect(identity.pinsChecked).toEqual([]);
    expect(actions(repositories.auditEvents)).toEqual(['PIX_CANCELLED']);
  });

  // The check that counts: the balance may have changed since creation.
  it('fails the Pix when the balance no longer covers it, without posting', async () => {
    const { repositories, ledger, authorize } = setup();
    ledger.balances.set('account-a', Money.of(5_000n));

    const result = await authorize.execute(input());

    expect(result).toMatchObject({ status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' });
    expect(ledger.posted).toEqual([]);
    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIX_FAILED',
        metadata: { sessionId: 'session-a', reason: 'INSUFFICIENT_FUNDS' },
      }),
    ]);
  });

  // PIX-10: created at 19:55 in São Paulo for R$ 2.000,00, authorized at 20:00 (23:00 UTC).
  it('fails the Pix when the limit in force at authorization is lower', async () => {
    const { repositories, ledger, clock, authorize } = setup(200_000n);
    ledger.balances.set('account-a', Money.of(1_000_000n));
    const [created] = repositories.transfers;
    if (!created) throw new Error('setup created no Pix');
    repositories.transfers[0] = {
      ...created,
      createdAt: new Date('2026-10-08T22:55:00.000Z'),
      expiresAt: new Date('2026-10-08T23:05:00.000Z'),
    };
    clock.current = new Date('2026-10-08T23:00:00.000Z');

    await expect(authorize.execute(input())).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'LIMIT_EXCEEDED',
    });
    expect(ledger.posted).toEqual([]);
  });
  it.each([
    ['the payer account is blocked', 'account-a', 'ACCOUNT_BLOCKED'],
    ['the payee account cannot receive', 'account-b', 'PAYEE_UNAVAILABLE'],
  ])('fails the Pix when %s', async (_case, accountId, reason) => {
    const { accounts, ledger, authorize } = setup();
    const holderUserId = accountId === 'account-a' ? 'user-a' : 'user-b';
    accounts.accounts.set(accountId, { id: accountId, holderUserId, status: 'BLOCKED' });

    await expect(authorize.execute(input())).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: reason,
    });
    expect(ledger.posted).toEqual([]);
  });

  // PIX-02: the same request again gets the same answer and posts nothing more.
  it('answers a repeated request with the stored response and one posting', async () => {
    const { ledger, authorize } = setup();
    const request = input();
    const first = await authorize.execute(request);

    await expect(authorize.execute(request)).resolves.toEqual(first);
    expect(ledger.posted).toHaveLength(1);
  });

  it('refuses the same key for another Pix (IdempotencyKeyReused)', async () => {
    const { authorize } = setup();
    const request = input();
    await authorize.execute(request);

    await expect(authorize.execute({ ...request, transferId: 'pix-2' })).rejects.toThrow(
      IdempotencyKeyReused,
    );
  });

  it('refuses to authorize a Pix twice (InvalidTransferState, PIX-08)', async () => {
    const { authorize } = setup();
    await authorize.execute(input());

    await expect(authorize.execute(input())).rejects.toThrow(InvalidTransferState);
  });

  it("never authorizes someone else's Pix (NotFound, PIX-01)", async () => {
    const { accounts, identity, authorize } = setup();
    accounts.accounts.set('account-c', {
      id: 'account-c',
      holderUserId: 'user-c',
      status: 'ACTIVE',
    });

    await expect(authorize.execute(input({ userId: 'user-c' }))).rejects.toThrow(NotFound);
    expect(identity.pinsChecked).toEqual([]);
  });
});
