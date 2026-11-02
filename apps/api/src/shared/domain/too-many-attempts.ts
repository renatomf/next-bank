import { DomainError } from './domain-error.ts';

/**
 * Too many wrong attempts at a secret (catalog: 429): the logins of the
 * customers and of the staff block the same way (AUTH-01, STF-01).
 */
export class TooManyAttempts extends DomainError {
  readonly code = 'TooManyAttempts';

  constructor() {
    super('Too many login attempts for this account');
  }
}
