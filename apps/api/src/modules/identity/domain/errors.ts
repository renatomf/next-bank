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
