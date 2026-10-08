import { DomainError } from '../../../shared/domain/domain-error.ts';

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

/** Deliberately vague for the client: it must not confirm that an e-mail or CPF has an account. */
export class AlreadyRegistered extends DomainError {
  readonly code = 'AlreadyRegistered';

  constructor() {
    super('E-mail or CPF already registered');
  }
}

/** Missing, invalid or expired access token: the app refreshes once, then asks for login. */
export class Unauthenticated extends DomainError {
  readonly code = 'Unauthenticated';

  constructor() {
    super('Access token is missing, invalid or expired');
  }
}

/** Same answer for an unknown e-mail, a wrong password and a locked account (AUTH-02). */
export class InvalidCredentials extends DomainError {
  readonly code = 'InvalidCredentials';

  constructor() {
    super('Login refused');
  }
}

export class TooManyAttempts extends DomainError {
  readonly code = 'TooManyAttempts';

  constructor() {
    super('Too many login attempts for this account');
  }
}

/** A replaced refresh token came back: the session was revoked (AUTH-03). */
export class RefreshTokenReuseDetected extends DomainError {
  readonly code = 'RefreshTokenReuseDetected';

  constructor() {
    super('A replaced refresh token was presented; the session was revoked');
  }
}

/** The PIN is created once; changing it requires the password (threat model D7). */
export class PinAlreadyCreated extends DomainError {
  readonly code = 'PinAlreadyCreated';

  constructor() {
    super('Transaction PIN already created');
  }
}
