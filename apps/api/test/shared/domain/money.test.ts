import { describe, expect, it } from 'vitest';
import { Money } from '../../../src/shared/domain/money.ts';

// Money is an integer amount of cents with its currency (ADR 0006): exact
// arithmetic, never a floating-point number.
describe('Money', () => {
  it('holds an integer amount of cents in reais', () => {
    const money = Money.of(12_345n);

    expect(money.cents).toBe(12_345n);
    expect(money.currency).toBe('BRL');
  });

  it('starts from zero', () => {
    expect(Money.zero().cents).toBe(0n);
  });

  it('adds and subtracts exactly, without changing the operands', () => {
    const ten = Money.of(1_000n);
    const thirty = Money.of(3_000n);

    expect(ten.plus(thirty).cents).toBe(4_000n);
    expect(ten.minus(thirty).cents).toBe(-2_000n);
    expect(ten.cents).toBe(1_000n);
  });

  it('keeps cents exact where floating point would not (0.1 + 0.2)', () => {
    expect(Money.of(10n).plus(Money.of(20n)).cents).toBe(30n);
  });

  it('compares amounts', () => {
    expect(Money.of(-1n).isNegative()).toBe(true);
    expect(Money.zero().isNegative()).toBe(false);
    expect(Money.of(1n).isPositive()).toBe(true);
    expect(Money.zero().isPositive()).toBe(false);
    expect(Money.of(799n).isLessThan(Money.of(800n))).toBe(true);
    expect(Money.of(800n).isLessThan(Money.of(800n))).toBe(false);
    expect(Money.of(800n).equals(Money.of(800n))).toBe(true);
    expect(Money.of(800n).equals(Money.of(801n))).toBe(false);
  });

  // D1: integer cents in JSON; never a number that JSON readers would round.
  it('turns into the JSON integer of cents', () => {
    expect(Money.of(1_000_000n).toJsonAmount()).toBe(1_000_000);
    expect(Money.of(BigInt(Number.MAX_SAFE_INTEGER)).toJsonAmount()).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('refuses to become a JSON number it cannot represent exactly', () => {
    const tooLarge = Money.of(BigInt(Number.MAX_SAFE_INTEGER) + 1n);

    expect(() => tooLarge.toJsonAmount()).toThrow(/safe integer/);
  });
});
