import { DomainError } from '../../../shared/domain/domain-error.ts';

/** The account is already blocked (catalog: 409). */
export class AccountAlreadyBlocked extends DomainError {
  readonly code = 'AccountAlreadyBlocked';

  constructor() {
    super('The account is already blocked');
  }
}

/** Only a blocked account is unblocked (catalog: 409). */
export class AccountNotBlocked extends DomainError {
  readonly code = 'AccountNotBlocked';

  constructor() {
    super('The account is not blocked');
  }
}
