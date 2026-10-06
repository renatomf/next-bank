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

export class InvalidPin extends DomainError {
  readonly code = 'InvalidPin';

  constructor() {
    super('PIN must be 4 digits without a trivial pattern');
  }
}

export class PinLocked extends DomainError {
  readonly code = 'PinLocked';
  readonly lockedUntil: Date;

  constructor(lockedUntil: Date) {
    super('PIN verification is locked');
    this.lockedUntil = lockedUntil;
  }
}

export class PinResetRequired extends DomainError {
  readonly code = 'PinResetRequired';

  constructor() {
    super('PIN was locked too many times and must be reset with the password');
  }
}
