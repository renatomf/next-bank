import { describe, expect, it } from 'vitest';
import {
  TOP_UP_DAILY_LIMIT,
  assertWithinDailyLimit,
  startOfDayInSaoPaulo,
} from '../../../../src/modules/top-ups/domain/daily-limit.ts';
import { TopUpLimitExceeded } from '../../../../src/modules/top-ups/domain/errors.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// D6 (v1.1.0 plan, task 5): R$ 200,00 of top-ups per customer per day, the
// day of the server clock in São Paulo (UTC-3), never the device's.
describe('top-up daily limit', () => {
  it('is R$ 200,00', () => {
    expect(TOP_UP_DAILY_LIMIT.equals(Money.of(20_000n))).toBe(true);
  });

  it.each([
    ['in the afternoon', '2026-10-21T18:00:00.000Z', '2026-10-21T03:00:00.000Z'],
    ['just after midnight in São Paulo', '2026-10-21T03:00:00.000Z', '2026-10-21T03:00:00.000Z'],
    [
      'late at night, already the next day in UTC',
      '2026-10-22T02:59:59.999Z',
      '2026-10-21T03:00:00.000Z',
    ],
  ])('starts the day at midnight in São Paulo, %s', (_case, now, start) => {
    expect(startOfDayInSaoPaulo(new Date(now)).toISOString()).toBe(start);
  });

  it('accepts a top-up that reaches the limit exactly', () => {
    expect(() => {
      assertWithinDailyLimit(Money.of(15_000n), Money.of(5_000n));
    }).not.toThrow();
  });

  it('refuses one that passes it, saying the limit and what is left (TopUpLimitExceeded)', () => {
    let refusal: unknown;
    try {
      assertWithinDailyLimit(Money.of(18_000n), Money.of(3_000n));
    } catch (error) {
      refusal = error;
    }

    expect(refusal).toBeInstanceOf(TopUpLimitExceeded);
    const exceeded = refusal as TopUpLimitExceeded;
    expect(exceeded.limit.equals(TOP_UP_DAILY_LIMIT)).toBe(true);
    expect(exceeded.remaining.equals(Money.of(2_000n))).toBe(true);
  });
});
