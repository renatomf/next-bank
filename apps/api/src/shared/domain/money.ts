/** Only reais in V1; another currency would also need its own number of decimals. */
export type Currency = 'BRL';

/**
 * An amount of money as integer cents with its currency (ADR 0006). Immutable;
 * floating-point numbers never hold money. Mixing currencies is impossible
 * while `Currency` has a single value, so the type system checks it.
 */
export class Money {
  readonly cents: bigint;
  readonly currency: Currency;

  private constructor(cents: bigint, currency: Currency) {
    this.cents = cents;
    this.currency = currency;
  }

  static of(cents: bigint, currency: Currency = 'BRL'): Money {
    return new Money(cents, currency);
  }

  static zero(currency: Currency = 'BRL'): Money {
    return new Money(0n, currency);
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents, this.currency);
  }

  minus(other: Money): Money {
    return new Money(this.cents - other.cents, this.currency);
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  /**
   * The integer of cents sent in JSON (D1). A larger amount would be rounded
   * by any JSON reader, so it is refused instead of silently changed.
   */
  toJsonAmount(): number {
    const amount = Number(this.cents);
    if (!Number.isSafeInteger(amount)) {
      throw new RangeError(`${this.cents.toString()} cents is not a safe integer in JSON`);
    }
    return amount;
  }
}
