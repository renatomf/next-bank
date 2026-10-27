import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CreatePixSchedule,
  type CreatePixScheduleInput,
} from '../../../../src/modules/payments/application/create-pix-schedule.ts';
import {
  AccountBlocked,
  InvalidRecurrence,
  LimitExceeded,
  PixAuthorizationRefused,
  PixKeyNotFound,
  SamePayerAndPayee,
  ScheduleInPast,
  TooManyKeyLookups,
} from '../../../../src/modules/payments/domain/errors.ts';
import { InMemoryKeyLookupQuota } from '../../../../src/modules/payments/infrastructure/in-memory-key-lookup-quota.ts';
import { IdempotencyKeyReused } from '../../../../src/shared/domain/idempotency-errors.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import {
  AURORA_EMAIL,
  AURORA_KEY,
  FakeFingerprint,
  FakeKeyProtector,
  FakeSpi,
  FakeUnitOfWork,
  twoCustomers,
} from './fakes.ts';

// Scheduling a Pix (v1.2.0 plan, task 7; D10): the PIN is checked on the
// server once, now, and authorizes every occurrence; once per idempotency key
// (ADR 0007); the payee kept as found (S1). 15:00 UTC is 12:00 in São Paulo.
const NOW = new Date('2026-10-27T15:00:00.000Z');
const IDEMPOTENCY_KEY = randomUUID();

function setup() {
  const world = twoCustomers();
  const quota = new InMemoryKeyLookupQuota();
  const spi = new FakeSpi();
  spi.keys.set(AURORA_EMAIL, AURORA_KEY);
  const schedule = new CreatePixSchedule({
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    protector: new FakeKeyProtector(),
    fingerprint: new FakeFingerprint(),
    accounts: world.accounts,
    identity: world.identity,
    quota,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    spi,
  });
  return { ...world, quota, spi, schedule };
}

function input(overrides: Partial<CreatePixScheduleInput> = {}): CreatePixScheduleInput {
  return {
    userId: 'user-a',
    sessionId: 'session-a',
    idempotencyKey: IDEMPOTENCY_KEY,
    key: { type: 'CPF', value: '123.456.789-09' },
    amountCents: 15_000,
    description: 'Aluguel',
    firstDate: '2026-11-05',
    recurrence: { frequency: 'MONTHLY', times: 3 },
    pin: '1357',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('CreatePixSchedule', () => {
  it('schedules the Pix with the PIN checked and answers what the client may see', async () => {
    const { schedule, identity } = setup();

    const view = await schedule.execute(input());

    expect(view).toEqual({
      id: 'id-1',
      status: 'ACTIVE',
      amount: { amount: 15_000, currency: 'BRL' },
      description: 'Aluguel',
      payee: {
        name: 'Marina Costa',
        documentMasked: '***.456.789-**',
        keyType: 'CPF',
        keyMasked: '***.456.789-**',
      },
      firstDate: '2026-11-05',
      recurrence: { frequency: 'MONTHLY', times: 3 },
      nextOccurrenceDate: '2026-11-05',
      lastOccurrenceDate: '2027-01-05',
      createdAt: NOW.toISOString(),
      cancelledAt: null,
    });
    expect(identity.pinsChecked).toEqual(['1357']);
  });

  it('keeps the schedule with the payee found, and moves no money', async () => {
    const { schedule, repositories, ledger } = setup();
    // Not even the balance is checked: the one of each occurrence's day counts.
    ledger.balances.set('account-a', Money.zero());

    await schedule.execute(input());

    expect(repositories.schedules).toHaveLength(1);
    expect(repositories.schedules[0]).toMatchObject({
      payerAccountId: 'account-a',
      payee: { accountId: 'account-b', name: 'Marina Costa' },
      status: 'ACTIVE',
      nextSequence: 1,
    });
    expect(ledger.posted).toEqual([]);
  });

  it('keeps a payee at another bank with its bank and its key sealed (S1)', async () => {
    const { schedule, repositories } = setup();

    const view = await schedule.execute(input({ key: { type: 'EMAIL', value: AURORA_EMAIL } }));

    expect(view.payee.bank).toEqual({ ispb: '99900001', name: 'Banco Aurora' });
    expect(repositories.schedules[0]?.payee.accountId).toBeNull();
    expect(new TextDecoder().decode(repositories.scheduleKeys.get('id-1')?.ciphertext)).toBe(
      `sealed(EMAIL:${AURORA_EMAIL})`,
    );
  });

  it('records who scheduled it, from which session, without the key (PIX-09)', async () => {
    const { schedule, repositories } = setup();

    await schedule.execute(input());

    expect(repositories.auditEvents).toEqual([
      {
        id: 'id-2',
        occurredAt: NOW,
        actorType: 'USER',
        actorId: 'user-a',
        action: 'PIX_SCHEDULE_CREATED',
        subjectType: 'PIX_SCHEDULE',
        subjectId: 'id-1',
        requestId: 'req-1',
        metadata: {
          sessionId: 'session-a',
          amountCents: 15_000,
          keyType: 'CPF',
          frequency: 'MONTHLY',
          times: 3,
        },
      },
    ]);
  });

  it('answers a repeated request the same, with one schedule and one PIN check', async () => {
    const { schedule, repositories, identity } = setup();

    const first = await schedule.execute(input());
    const second = await schedule.execute(input());

    expect(second).toEqual(first);
    expect(repositories.schedules).toHaveLength(1);
    expect(identity.pinsChecked).toHaveLength(1);
  });

  it('refuses the same key for another request', async () => {
    const { schedule } = setup();
    await schedule.execute(input());

    await expect(schedule.execute(input({ amountCents: 9_999 }))).rejects.toThrow(
      IdempotencyKeyReused,
    );
  });

  describe('with a PIN that does not authorize', () => {
    it('schedules nothing and keeps the refusal for the same request', async () => {
      const { schedule, repositories, identity } = setup();
      identity.pinOutcomes = [{ outcome: 'INCORRECT', remainingAttempts: 4 }];

      const refusal = schedule.execute(input());

      await expect(refusal).rejects.toThrow(PixAuthorizationRefused);
      await expect(refusal).rejects.toMatchObject({
        code: 'PinIncorrect',
        details: { remainingAttempts: 4 },
      });
      // The same request gets the same answer, without checking the PIN again.
      await expect(schedule.execute(input())).rejects.toMatchObject({ code: 'PinIncorrect' });
      expect(identity.pinsChecked).toHaveLength(1);
      expect(repositories.schedules).toEqual([]);
      expect(repositories.auditEvents).toEqual([]);
    });

    it.each([
      [{ outcome: 'LOCKED', lockedUntil: NOW } as const, 'PinLocked'],
      [{ outcome: 'RESET_REQUIRED' } as const, 'PinResetRequired'],
    ])('refuses a locked PIN (%s)', async (outcome, code) => {
      const { schedule, repositories, identity } = setup();
      identity.pinOutcomes = [outcome];

      await expect(schedule.execute(input())).rejects.toMatchObject({ code });
      expect(repositories.schedules).toEqual([]);
    });
  });

  // A malformed schedule costs no PIN attempt: it is refused before the PIN.
  it.each([
    ['today', { firstDate: '2026-10-27' }, ScheduleInPast],
    ['over a year ahead', { firstDate: '2027-10-28' }, InvalidRecurrence],
    ['25 times', { recurrence: { frequency: 'MONTHLY', times: 25 } as const }, InvalidRecurrence],
    ['above the daytime limit', { amountCents: 500_001 }, LimitExceeded],
  ])('refuses a schedule %s before the PIN', async (_case, overrides, error) => {
    const { schedule, identity, repositories } = setup();

    await expect(schedule.execute(input(overrides))).rejects.toThrow(error);
    expect(identity.pinsChecked).toEqual([]);
    expect(repositories.schedules).toEqual([]);
  });

  it('refuses a key nobody holds, which costs a lookup more (PIX-07)', async () => {
    const { schedule, quota } = setup();

    await expect(
      schedule.execute(input({ key: { type: 'CPF', value: '529.982.247-25' } })),
    ).rejects.toThrow(PixKeyNotFound);
    // One for the schedule, one more for the miss: 28 left of 30.
    expect(quota.tryTake('user-a', 28, NOW)).toBe(true);
    expect(quota.tryTake('user-a', 1, NOW)).toBe(false);
  });

  it('refuses when the lookups are spent, before anything else (PIX-07)', async () => {
    const { schedule, quota, identity } = setup();
    quota.tryTake('user-a', 30, NOW);

    await expect(schedule.execute(input())).rejects.toThrow(TooManyKeyLookups);
    expect(identity.pinsChecked).toEqual([]);
  });

  it('refuses a blocked payer', async () => {
    const { schedule, accounts } = setup();
    accounts.accounts.set('account-a', {
      id: 'account-a',
      holderUserId: 'user-a',
      status: 'BLOCKED',
    });

    await expect(schedule.execute(input())).rejects.toThrow(AccountBlocked);
  });

  it('refuses to schedule a Pix to the payer itself', async () => {
    const { schedule, repositories } = setup();
    repositories.addKey('CPF', '98765432100', {
      accountId: 'account-a',
      masked: '***.654.321-**',
    });

    await expect(
      schedule.execute(input({ key: { type: 'CPF', value: '987.654.321-00' } })),
    ).rejects.toThrow(SamePayerAndPayee);
  });
});
