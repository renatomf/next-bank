import { DomainError } from '../../../shared/domain/domain-error.ts';

export class InvalidCpf extends DomainError {
  readonly code = 'InvalidCpf';

  constructor() {
    super('CPF is invalid');
  }
}

export class WeakPassword extends DomainError {
  readonly code = 'WeakPassword';

  constructor() {
    super('Password does not meet the policy');
  }
}

export class SessionExpired extends DomainError {
  readonly code = 'SessionExpired';

  constructor() {
    super('Session is expired or revoked');
  }
}
