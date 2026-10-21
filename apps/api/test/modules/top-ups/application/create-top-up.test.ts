import { beforeEach, describe, expect, it } from 'vitest';
import {
  CreateTopUp,
  type CreateTopUpInput,
} from '../../../../src/modules/top-ups/application/create-top-up.ts';
import { GetTopUp } from '../../../../src/modules/top-ups/application/get-top-up.ts';
import {
  AccountBlocked,
  InvalidPhoneNumber,
  InvalidTopUpAmount,
  TopUpLimitExceeded,
  TopUpRefused,
  UnknownTopUpOperator,
} from '../../../../src/modules/top-ups/domain/errors.ts';
import { IdempotencyKeyReused } from '../../../../src/shared/domain/idempotency-errors.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeFingerprint, FakeUnitOfWork } from '../../payments/application/fakes.ts';
import {
  ANA,
  BRUNO,
  CallLog,
  FakeAccounts,
  FakeIdentity,
  FakeLedger,
  FakePhoneProtector,
  FakeProvider,
  FakeTopUpsRepositories,
} from './fakes.ts';

// A top-up (v1.1.0 plan, task 5): the PIN on the server, the day's limit read
// after the customer's lock, the money posted to the operator and the fake
// operator asked, all in one transaction, once per idempotency key.
describe('CreateTopUp', () => {
  // 15h in São Paulo: the day started at 03:00 UTC.
  const NOW = new Date('2026-10-21T18:00:00.000Z');
  let log: CallLog;
  let repositories: FakeTopUpsRepositories;
  let identity: FakeIdentity;
  let ledger: FakeLedger;
  let provider: FakeProvider;
  let createTopUp: CreateTopUp;

  const input = (overrides: Partial<CreateTopUpInput> = {}): CreateTopUpInput => ({
    userId: ANA.holderUserId,
    idempotencyKey: 'key-1',
    operatorId: 'pulso-celular',
    phoneNumber: '(11) 90000-0001',
    amount: Money.of(3000n),
    pin: '1234',
    requestId: 'request-1',
    ...overrides,
  });

  beforeEach(() => {
    log = new CallLog();
    repositories = new FakeTopUpsRepositories(log);
    identity = new FakeIdentity();
    ledger = new FakeLedger(log);
    provider = new FakeProvider(log);
    createTopUp = new CreateTopUp({
      unitOfWork: new FakeUnitOfWork(),
      repositories,
      fingerprint: new FakeFingerprint(),
      accounts: new FakeAccounts([
        ANA,
        BRUNO,
        { ...ANA, id: 'blocked', holderUserId: 'user-blocked', status: 'BLOCKED' },
      ]),
      identity,
      ledger,
      provider,
      protector: new FakePhoneProtector(),
      clock: new FixedClock(NOW),
      ids: new SequentialIds(),
    });
  });

  it('tops up: posts to the operator, asks it and keeps the number only masked', async () => {
    const view = await createTopUp.execute(input());

    expect(view).toEqual({
      id: 'id-1',
      operator: { id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC' },
      phoneMasked: '(11) *****-0001',
      // Plain JSON, like the Pix view: stored as the idempotent response.
      amount: { amount: 3000, currency: 'BRL' },
      status: 'COMPLETED',
      createdAt: NOW.toISOString(),
    });
    expect(ledger.postings).toEqual([
      {
        topUpId: 'id-1',
        accountId: ANA.id,
        operatorId: 'pulso-celular',
        amount: Money.of(3000n),
        counterparty: { name: 'Pulso Celular', documentMasked: '(11) *****-0001' },
      },
    ]);
    expect(provider.requests).toEqual([
      {
        topUpId: 'id-1',
        operatorId: 'pulso-celular',
        phoneDigits: '11900000001',
        amount: Money.of(3000n),
      },
    ]);
    const [stored] = repositories.topUps;
    expect(stored?.state.phoneMasked).toBe('(11) *****-0001');
    expect(new TextDecoder().decode(stored?.phone.ciphertext)).not.toContain('11900000001');
    expect(stored?.state.providerReference).toBe('ref-1');
  });

  it('audits the top-up in the same transaction, without the number (PIX-09, MOB-02)', async () => {
    await createTopUp.execute(input());

    expect(repositories.audit).toEqual([
      expect.objectContaining({
        actorType: 'USER',
        actorId: ANA.holderUserId,
        action: 'TOP_UP_COMPLETED',
        subjectType: 'TOP_UP',
        subjectId: 'id-1',
        requestId: 'request-1',
        metadata: { operatorId: 'pulso-celular', amountCents: 3000 },
      }),
    ]);
  });

  it('reads the day total after locking the customer, from midnight in São Paulo (D6)', async () => {
    await createTopUp.execute(input());

    expect(log.calls.indexOf('lockCustomerAccount')).toBeLessThan(log.calls.indexOf('spentSince'));
    expect(repositories.sinceAsked?.toISOString()).toBe('2026-10-21T03:00:00.000Z');
    // The money moves before the operator is asked: a refusal by the ledger never reaches it.
    expect(log.calls.indexOf('postTopUp')).toBeLessThan(log.calls.indexOf('recharge'));
  });

  it.each([
    ['an unknown operator', { operatorId: 'vivo' }, UnknownTopUpOperator],
    ['an amount not offered', { amount: Money.of(2500n) }, InvalidTopUpAmount],
    ['a real-looking number', { phoneNumber: '11987654321' }, InvalidPhoneNumber],
  ])('refuses %s before checking the PIN', async (_case, overrides, error) => {
    await expect(createTopUp.execute(input(overrides))).rejects.toThrow(error);

    expect(identity.checks).toBe(0);
    expect(ledger.postings).toEqual([]);
  });

  it('refuses a top-up that passes the day limit, saying what is left (TopUpLimitExceeded)', async () => {
    repositories.spentToday = Money.of(18_000n);

    await expect(createTopUp.execute(input({ amount: Money.of(5000n) }))).rejects.toThrow(
      TopUpLimitExceeded,
    );
    expect(ledger.postings).toEqual([]);
    expect(provider.requests).toEqual([]);
  });

  it('lets the ledger refuse a balance that does not cover it, before the operator', async () => {
    ledger.balance = Money.of(1000n);

    await expect(createTopUp.execute(input())).rejects.toMatchObject({ code: 'InsufficientFunds' });
    expect(provider.requests).toEqual([]);
    expect(repositories.topUps).toEqual([]);
  });

  it('refuses a blocked account (AccountBlocked)', async () => {
    await expect(createTopUp.execute(input({ userId: 'user-blocked' }))).rejects.toThrow(
      AccountBlocked,
    );
    expect(ledger.postings).toEqual([]);
  });

  it('answers a customer without an account as not found', async () => {
    await expect(createTopUp.execute(input({ userId: 'nobody' }))).rejects.toThrow(NotFound);
  });

  it('lets an operator failure through, so the transaction undoes the posting', async () => {
    provider.fails = true;

    await expect(createTopUp.execute(input())).rejects.toThrow('operator unavailable');
    expect(repositories.topUps).toEqual([]);
  });

  describe('the PIN, checked on the server (ADR 0004, PIX-05)', () => {
    it.each([
      [
        'incorrect',
        { outcome: 'INCORRECT', remainingAttempts: 2 } as const,
        'PinIncorrect',
        { remainingAttempts: 2 },
      ],
      ['locked', { outcome: 'LOCKED' } as const, 'PinLocked', {}],
      ['to be reset', { outcome: 'RESET_REQUIRED' } as const, 'PinResetRequired', {}],
    ])('refuses a PIN %s and moves no money', async (_case, check, code, details) => {
      identity.next = check;

      const refusal = await createTopUp.execute(input()).catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(TopUpRefused);
      expect((refusal as TopUpRefused).code).toBe(code);
      expect((refusal as TopUpRefused).details).toEqual(details);
      expect(ledger.postings).toEqual([]);
    });

    it('keeps the refusal with the key: a repeat gets it without checking the PIN again', async () => {
      identity.next = { outcome: 'INCORRECT', remainingAttempts: 2 };
      await createTopUp.execute(input()).catch(() => undefined);
      identity.next = { outcome: 'VERIFIED' };

      await expect(createTopUp.execute(input())).rejects.toThrow(TopUpRefused);
      expect(identity.checks).toBe(1);
    });
  });

  describe('idempotency (TOP-02, ADR 0007)', () => {
    it('tops up once for the same key and request, giving the same answer', async () => {
      const first = await createTopUp.execute(input());
      const second = await createTopUp.execute(input());

      expect(second).toEqual(first);
      expect(ledger.postings).toHaveLength(1);
      expect(provider.requests).toHaveLength(1);
    });

    it('gives the first answer to the same key with another PIN (never part of the request)', async () => {
      const first = await createTopUp.execute(input());

      await expect(createTopUp.execute(input({ pin: '9999' }))).resolves.toEqual(first);
    });

    it('refuses the same key with another top-up (IdempotencyKeyReused)', async () => {
      await createTopUp.execute(input());

      await expect(createTopUp.execute(input({ amount: Money.of(5000n) }))).rejects.toThrow(
        IdempotencyKeyReused,
      );
    });
  });

  describe('GetTopUp, the receipt', () => {
    let getTopUp: GetTopUp;

    beforeEach(() => {
      getTopUp = new GetTopUp({
        unitOfWork: new FakeUnitOfWork(),
        repositories,
        accounts: new FakeAccounts([ANA, BRUNO]),
      });
    });

    it('shows the owner their top-up', async () => {
      const created = await createTopUp.execute(input());

      await expect(getTopUp.execute(ANA.holderUserId, created.id)).resolves.toEqual(created);
    });

    it("answers another customer's top-up as not found (IDOR, READ-01)", async () => {
      const created = await createTopUp.execute(input());

      await expect(getTopUp.execute(BRUNO.holderUserId, created.id)).rejects.toThrow(NotFound);
    });
  });
});
