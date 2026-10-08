import { describe, expect, it } from 'vitest';
import { LimitExceeded } from '../../../../src/modules/payments/domain/errors.ts';
import {
  assertWithinLimit,
  transferLimitAt,
} from '../../../../src/modules/payments/domain/transfer-limits.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// Limits per transfer (domain-model.md 7; PIX-10): R$ 5.000,00 from 6h to 20h
// and R$ 1.000,00 from 20h to 6h, by the server clock in São Paulo (UTC-3).
const DAY = Money.of(500_000n);
const NIGHT = Money.of(100_000n);

describe('transfer limits', () => {
  it.each([
    ['05:59 in São Paulo', '2026-10-07T08:59:59.999Z', NIGHT],
    ['06:00 in São Paulo', '2026-10-07T09:00:00.000Z', DAY],
    ['19:59 in São Paulo', '2026-10-07T22:59:59.999Z', DAY],
    ['20:00 in São Paulo', '2026-10-07T23:00:00.000Z', NIGHT],
    ['midnight in São Paulo, already the next day in UTC', '2026-10-08T03:00:00.000Z', NIGHT],
  ])('applies the right limit at %s', (_case, instant, limit) => {
    expect(transferLimitAt(new Date(instant)).equals(limit)).toBe(true);
  });

  it('accepts an amount equal to the limit', () => {
    expect(() => {
      assertWithinLimit(Money.of(100_000n), new Date('2026-10-08T00:00:00.000Z'));
    }).not.toThrow();
  });

  it('refuses one cent above the night limit, saying which limit applies (LimitExceeded)', () => {
    const night = new Date('2026-10-08T00:00:00.000Z');

    expect(() => {
      assertWithinLimit(Money.of(100_001n), night);
    }).toThrow(LimitExceeded);
    try {
      assertWithinLimit(Money.of(100_001n), night);
    } catch (error) {
      expect((error as LimitExceeded).limit.equals(NIGHT)).toBe(true);
    }
  });

  it('allows by day what the night limit refuses', () => {
    expect(() => {
      assertWithinLimit(Money.of(100_001n), new Date('2026-10-07T15:00:00.000Z'));
    }).not.toThrow();
    expect(() => {
      assertWithinLimit(Money.of(500_001n), new Date('2026-10-07T15:00:00.000Z'));
    }).toThrow(LimitExceeded);
  });
});
