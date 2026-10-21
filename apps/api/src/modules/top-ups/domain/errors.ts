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
