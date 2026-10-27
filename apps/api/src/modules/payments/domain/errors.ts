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

/**
 * An authorization the customer must act on, recorded before answering
 * (ADR 0010, rule 3) and stored with the idempotency key, so a repeated request
 * gets the same refusal without checking the PIN again (D5).
 */
export type AuthorizationRefusal =
  'PinIncorrect' | 'PinLocked' | 'PinResetRequired' | 'TransferExpired';

export class PixAuthorizationRefused extends DomainError {
  readonly code: AuthorizationRefusal;
  readonly #details: Readonly<Record<string, number>>;

  constructor(code: AuthorizationRefusal, details: Readonly<Record<string, number>> = {}) {
    super(`Pix authorization refused: ${code}`);
    this.code = code;
    this.#details = details;
  }

  override get details(): Readonly<Record<string, number>> {
    return this.#details;
  }
}

export class InvalidTransferState extends DomainError {
  readonly code = 'InvalidTransferState';

  constructor() {
    super('Pix transfer is not in a state that allows this');
  }
}

/** A schedule's first date is today or before: for today there is the Pix itself (S7). */
export class ScheduleInPast extends DomainError {
  readonly code = 'ScheduleInPast';

  constructor() {
    super('A Pix is scheduled from tomorrow on');
  }
}

/** A first date over a year ahead, or a monthly Pix outside 2 to 24 times (S2, S7). */
export class InvalidRecurrence extends DomainError {
  readonly code = 'InvalidRecurrence';

  constructor() {
    super('A schedule starts within a year and repeats from 2 to 24 times');
  }
}

/** The schedule is finished, or cancelled, and takes no more changes (S6). */
export class ScheduleNotActive extends DomainError {
  readonly code = 'ScheduleNotActive';

  constructor() {
    super('The Pix schedule is not active');
  }
}
