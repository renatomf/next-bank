import { DomainError } from '../../../shared/domain/domain-error.ts';

/** A debit above the available balance of a customer account (catalog: 422). */
export class InsufficientFunds extends DomainError {
  readonly code = 'InsufficientFunds';

  constructor() {
    super('Debit above the available balance');
  }
}
