import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { Money } from '../../../shared/domain/money.ts';

export class PixKeyNotFound extends DomainError {
  readonly code = 'PixKeyNotFound';

  constructor() {
    super('No Pix key matches');
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
}

export class InvalidTransferState extends DomainError {
  readonly code = 'InvalidTransferState';

  constructor() {
    super('Pix transfer is not in a state that allows this');
  }
}
