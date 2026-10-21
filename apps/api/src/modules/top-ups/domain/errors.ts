import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Money } from '../../../shared/domain/money.ts';

/** Only the made-up range (DD) 90000-XXXX is taken (TOP-01, decision R1). */
export class InvalidPhoneNumber extends DomainError {
  readonly code = 'InvalidPhoneNumber';

  constructor() {
    super('Phone number must be a made-up one: (DD) 90000-XXXX');
  }
}

export class UnknownTopUpOperator extends DomainError {
  readonly code = 'UnknownTopUpOperator';

  constructor() {
    super('No top-up operator has this id');
  }
}

/** Only the fixed amounts are offered (D6). */
export class InvalidTopUpAmount extends DomainError {
  readonly code = 'InvalidTopUpAmount';

  constructor() {
    super('Top-up amount is not one of the offered amounts');
  }
}

export class AccountBlocked extends DomainError {
  readonly code = 'AccountBlocked';

  constructor() {
    super('The account cannot send money');
  }
}

/**
 * A PIN refusal the customer must act on, kept with the idempotency key
 * before answering (ADR 0010, rule 3): the attempt counted stays counted,
 * and a repeated request gets the same refusal without checking again.
 */
export type TopUpRefusal = 'PinIncorrect' | 'PinLocked' | 'PinResetRequired';

export class TopUpRefused extends DomainError {
  readonly code: TopUpRefusal;
  readonly #details: Readonly<Record<string, number>>;

  constructor(code: TopUpRefusal, details: Readonly<Record<string, number>> = {}) {
    super(`Top-up refused: ${code}`);
    this.code = code;
    this.#details = details;
  }

  override get details(): Readonly<Record<string, number>> {
    return this.#details;
  }
}

/** Top-ups of the day would pass the daily limit (D6). */
export class TopUpLimitExceeded extends DomainError {
  readonly code = 'TopUpLimitExceeded';
  /** The daily limit in force. */
  readonly limit: Money;
  /** What is left to top up today, shown to the customer. */
  readonly remaining: Money;

  constructor(limit: Money, remaining: Money) {
    super('Top-ups of the day would pass the daily limit');
    this.limit = limit;
    this.remaining = remaining;
  }

  override get details(): Readonly<Record<string, number>> {
    return {
      limitCents: this.limit.toJsonAmount(),
      remainingCents: this.remaining.toJsonAmount(),
    };
  }
}
