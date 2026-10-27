import { describe, expect, it } from 'vitest';
import {
  InvalidAmount,
  InvalidRecurrence,
  LimitExceeded,
  SamePayerAndPayee,
  ScheduleInPast,
  ScheduleNotActive,
} from '../../../../src/modules/payments/domain/errors.ts';
import {
  type CreatePixScheduleInput,
  PixSchedule,
} from '../../../../src/modules/payments/domain/pix-schedule.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// A scheduled or recurring Pix (v1.2.0 plan, task 7; D9, D10): authorized once
// with the PIN, then paid on each date by the worker. Dates are São Paulo's
// (UTC−3); 15:00 UTC is 12:00 there.
const NOW = new Date('2026-10-27T15:00:00.000Z');
const LATER = new Date('2026-10-27T15:05:00.000Z');

const PAYEE = {
  accountId: 'account-b',
  name: 'Marina Costa',
  documentMasked: '***.842.917-**',
  keyType: 'CPF' as const,
  keyMasked: '***.842.917-**',
};

function input(overrides: Partial<CreatePixScheduleInput> = {}): CreatePixScheduleInput {
  return {
    id: 'schedule-1',
    payerAccountId: 'account-a',
    payee: PAYEE,
    amount: Money.of(15_000n),
    description: 'Aluguel',
    firstDate: '2026-11-05',
    recurrence: { frequency: 'MONTHLY', times: 3 },
    now: NOW,
    ...overrides,
  };
}

/** Noon in São Paulo on [date]. */
const noonOf = (date: string) => new Date(`${date}T12:00:00-03:00`);

describe('PixSchedule.create', () => {
  it('is born active, waiting for its first date, with the payee snapshot', () => {
    const { state } = PixSchedule.create(input());

    expect(state).toEqual({
      id: 'schedule-1',
      payerAccountId: 'account-a',
      payee: PAYEE,
      amount: Money.of(15_000n),
      description: 'Aluguel',
      firstDate: '2026-11-05',
      recurrence: { frequency: 'MONTHLY', times: 3 },
      status: 'ACTIVE',
      nextSequence: 1,
      nextOccurrenceDate: '2026-11-05',
      version: 0,
      createdAt: NOW,
      cancelledAt: null,
      updatedAt: NOW,
    });
  });

  it('keeps a payee at another bank, with its bank', () => {
    const payee = {
      accountId: null,
      bank: { ispb: '11111111', name: 'Banco Aurora' },
      name: 'Rafael Lima',
      documentMasked: '***.123.456-**',
      keyType: 'EMAIL' as const,
      keyMasked: 'ra***@exemplo.com',
    };

    expect(PixSchedule.create(input({ payee })).state.payee).toEqual(payee);
  });

  it('is paid once when it is not recurring', () => {
    expect(PixSchedule.create(input({ recurrence: { frequency: 'ONCE' } })).times).toBe(1);
  });

  // S7: for today there is the Pix itself.
  it.each(['2026-10-27', '2026-10-26'])('refuses %s, not after today', (firstDate) => {
    expect(() => PixSchedule.create(input({ firstDate }))).toThrow(ScheduleInPast);
  });

  it('takes the day of São Paulo, not UTC, as today', () => {
    // 01:00 UTC on the 28th is still the 27th in São Paulo.
    const lateNight = new Date('2026-10-28T01:00:00.000Z');

    expect(() =>
      PixSchedule.create(input({ firstDate: '2026-10-28', now: lateNight })),
    ).not.toThrow();
  });

  it('accepts up to 365 days ahead, and refuses one day more (S7)', () => {
    expect(() => PixSchedule.create(input({ firstDate: '2027-10-27' }))).not.toThrow();
    expect(() => PixSchedule.create(input({ firstDate: '2027-10-28' }))).toThrow(
      InvalidRecurrence,
    );
  });

  // S2: from 2 to 24 times; once is ONCE.
  it.each([1, 25, 2.5])('refuses a monthly Pix of %s times', (times) => {
    expect(() =>
      PixSchedule.create(input({ recurrence: { frequency: 'MONTHLY', times } })),
    ).toThrow(InvalidRecurrence);
  });

  it.each([2, 24])('accepts a monthly Pix of %s times', (times) => {
    expect(PixSchedule.create(input({ recurrence: { frequency: 'MONTHLY', times } })).times).toBe(
      times,
    );
  });

  it('refuses an amount that is not positive', () => {
    expect(() => PixSchedule.create(input({ amount: Money.of(0n) }))).toThrow(InvalidAmount);
  });

  // S3: it always runs in the daytime, whatever the hour it is scheduled at.
  it('refuses an amount above the daytime limit, even at night', () => {
    const night = new Date('2026-10-28T00:30:00.000Z');

    expect(() =>
      PixSchedule.create(input({ amount: Money.of(500_000n), now: night })),
    ).not.toThrow();
    expect(() => PixSchedule.create(input({ amount: Money.of(500_001n), now: night }))).toThrow(
      LimitExceeded,
    );
  });

  it('refuses to pay the payer itself', () => {
    expect(() =>
      PixSchedule.create(input({ payee: { ...PAYEE, accountId: 'account-a' } })),
    ).toThrow(SamePayerAndPayee);
  });

  it('refuses a description over 140 characters, and keeps an empty one as none', () => {
    expect(() => PixSchedule.create(input({ description: 'a'.repeat(141) }))).toThrow();
    expect(PixSchedule.create(input({ description: '' })).state.description).toBeNull();
  });
});

// S2: on the first date's day each month, counted from the first date, and on
// the last day of a shorter month.
describe('PixSchedule.occurrenceDate', () => {
  it('falls on the same day every month, across the year', () => {
    const schedule = PixSchedule.create(
      input({ firstDate: '2026-11-05', recurrence: { frequency: 'MONTHLY', times: 4 } }),
    );

    expect([1, 2, 3, 4].map((n) => schedule.occurrenceDate(n))).toEqual([
      '2026-11-05',
      '2026-12-05',
      '2027-01-05',
      '2027-02-05',
    ]);
  });

  it('takes the last day of a shorter month, and goes back to the 31st after it', () => {
    const schedule = PixSchedule.create(
      input({ firstDate: '2027-01-31', recurrence: { frequency: 'MONTHLY', times: 4 } }),
    );

    expect([1, 2, 3, 4].map((n) => schedule.occurrenceDate(n))).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });

  it('knows a leap year', () => {
    const schedule = PixSchedule.create(
      input({ firstDate: '2027-01-29', recurrence: { frequency: 'MONTHLY', times: 14 } }),
    );

    expect(schedule.occurrenceDate(2)).toBe('2027-02-28');
    expect(schedule.occurrenceDate(14)).toBe('2028-02-29');
  });
});

// S3 and S4: due on its date or after, from 06:00 to 20:00 in São Paulo.
describe('PixSchedule.dueSequence', () => {
  const schedule = () => PixSchedule.create(input());

  it('is nothing before the date', () => {
    expect(schedule().dueSequence(noonOf('2026-11-04'))).toBeNull();
  });

  it.each([
    ['06:00', '2026-11-05T06:00:00-03:00', 1],
    ['19:59', '2026-11-05T19:59:59-03:00', 1],
    ['05:59', '2026-11-05T05:59:59-03:00', null],
    ['20:00', '2026-11-05T20:00:00-03:00', null],
  ])('on its date at %s is %s', (_hour, instant, due) => {
    expect(schedule().dueSequence(new Date(instant))).toBe(due);
  });

  it('is still due days later, when it did not run on its date (S4)', () => {
    expect(schedule().dueSequence(noonOf('2026-11-20'))).toBe(1);
  });

  it('is nothing once cancelled or finished', () => {
    const cancelled = schedule();
    cancelled.cancel(LATER);
    const once = PixSchedule.create(input({ recurrence: { frequency: 'ONCE' } }));
    once.advance(1, noonOf('2026-11-05'));

    expect(cancelled.dueSequence(noonOf('2026-11-05'))).toBeNull();
    expect(once.dueSequence(noonOf('2026-11-05'))).toBeNull();
  });
});

// S5: an occurrence moves the schedule on, paid or failed; the last ends it.
describe('PixSchedule.advance', () => {
  it('moves to the next occurrence', () => {
    const schedule = PixSchedule.create(input());

    schedule.advance(1, noonOf('2026-11-05'));

    expect(schedule.state).toMatchObject({
      status: 'ACTIVE',
      nextSequence: 2,
      nextOccurrenceDate: '2026-12-05',
      version: 1,
      updatedAt: noonOf('2026-11-05'),
    });
  });

  it('finishes after the last occurrence', () => {
    const schedule = PixSchedule.create(input({ recurrence: { frequency: 'MONTHLY', times: 2 } }));

    schedule.advance(1, noonOf('2026-11-05'));
    schedule.advance(2, noonOf('2026-12-05'));

    expect(schedule.state).toMatchObject({
      status: 'FINISHED',
      nextSequence: null,
      nextOccurrenceDate: null,
      version: 2,
    });
  });

  it('refuses any occurrence but the next one: none is paid twice (EXT-05)', () => {
    const schedule = PixSchedule.create(input());
    schedule.advance(1, noonOf('2026-11-05'));

    expect(() => {
      schedule.advance(1, noonOf('2026-11-05'));
    }).toThrow();
    expect(() => {
      schedule.advance(3, noonOf('2026-11-05'));
    }).toThrow();
  });

  it('refuses to move a schedule that is not active', () => {
    const schedule = PixSchedule.create(input());
    schedule.cancel(LATER);

    expect(() => {
      schedule.advance(1, noonOf('2026-11-05'));
    }).toThrow(ScheduleNotActive);
  });
});

// S6: cancelling only turns off what was authorized.
describe('PixSchedule.cancel', () => {
  it('cancels an active schedule, which has no next occurrence anymore', () => {
    const schedule = PixSchedule.create(input());

    expect(schedule.cancel(LATER)).toBe(true);
    expect(schedule.state).toMatchObject({
      status: 'CANCELLED',
      nextSequence: null,
      nextOccurrenceDate: null,
      cancelledAt: LATER,
      updatedAt: LATER,
      version: 1,
    });
  });

  it('changes nothing on a cancelled one: a repeated request is no error', () => {
    const schedule = PixSchedule.create(input());
    schedule.cancel(LATER);

    expect(schedule.cancel(noonOf('2026-11-01'))).toBe(false);
    expect(schedule.state).toMatchObject({ cancelledAt: LATER, version: 1 });
  });

  it('refuses a finished one', () => {
    const schedule = PixSchedule.create(input({ recurrence: { frequency: 'ONCE' } }));
    schedule.advance(1, noonOf('2026-11-05'));

    expect(() => schedule.cancel(noonOf('2026-11-06'))).toThrow(ScheduleNotActive);
  });
});

describe('PixSchedule.restore', () => {
  it('comes back as it was stored', () => {
    const { state } = PixSchedule.create(input());

    expect(PixSchedule.restore(state).state).toEqual(state);
  });
});
