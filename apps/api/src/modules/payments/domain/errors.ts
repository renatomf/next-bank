import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Money } from '../../../shared/domain/money.ts';

export class PixKeyNotFound extends DomainError {
  readonly code = 'PixKeyNotFound';

  constructor() {
    super('No Pix key matches');
  }
}

/** The lookup quota is spent: keys cannot be swept for names (PIX-07). */
export class TooManyKeyLookups extends DomainError {
  readonly code = 'TooManyAttempts';

  constructor() {
    super('Too many Pix key lookups for this customer');
  }
}

export class InvalidAmount extends DomainError {
  readonly code = 'InvalidAmount';

  constructor() {
    super('Pix amount must be at least one cent');
  }
}

export class SamePayerAndPayee extends DomainError {
  readonly code = 'SamePayerAndPayee';

  constructor() {
    super('Payer and payee are the same account');
  }
}

export class LimitExceeded extends DomainError {
  readonly code = 'LimitExceeded';
  /** The limit in force, shown to the customer (domain-model.md, section 9). */
  readonly limit: Money;

  constructor(limit: Money) {
    super('Pix amount is above the limit in force');
    this.limit = limit;
  }

  override get details(): Readonly<Record<string, number>> {
    return { limitCents: this.limit.toJsonAmount() };
  }
}

export class InsufficientFunds extends DomainError {
  readonly code = 'InsufficientFunds';

  constructor() {
    super('Pix amount is above the available balance');
  }
}

export class AccountBlocked extends DomainError {
  readonly code = 'AccountBlocked';

  constructor() {
    super('The payer account cannot send money');
  }
}

/** The same Idempotency-Key came with another request: a client bug (ADR 0007). */
export class IdempotencyKeyReused extends DomainError {
  readonly code = 'IdempotencyKeyReused';

  constructor() {
    super('Idempotency key already used for another request');
  }
}

/** The first request with this key is still running; the client asks again later. */
export class RequestInProgress extends DomainError {
  readonly code = 'RequestInProgress';

  constructor() {
    super('A request with this idempotency key is still in progress');
  }
}

export class InvalidTransferState extends DomainError {
  readonly code = 'InvalidTransferState';

  constructor() {
    super('Pix transfer is not in a state that allows this');
  }
}
