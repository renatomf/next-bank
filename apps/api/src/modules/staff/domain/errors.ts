import { DomainError } from '../../../shared/domain/domain-error.ts';

/** Any wrong factor of the staff's login, with the same answer for all (STF-01, S2). */
export class InvalidCredentials extends DomainError {
  readonly code = 'InvalidCredentials';

  constructor() {
    super('Login refused');
  }
}

/** No staff session behind the token, or no backoffice credential (STF-08). */
export class Unauthenticated extends DomainError {
  readonly code = 'Unauthenticated';

  constructor() {
    super('Staff session or backoffice credential missing or invalid');
  }
}

/** The session ended: idle, too old, revoked, or its member disabled (STF-06). */
export class StaffSessionExpired extends DomainError {
  readonly code = 'StaffSessionExpired';

  constructor() {
    super('Staff session is expired or revoked');
  }
}

/** The member's role does not grant what the route needs (STF-02). */
export class Forbidden extends DomainError {
  readonly code = 'Forbidden';

  constructor() {
    super('The role does not grant this permission');
  }
}

export class InvalidStaffMember extends DomainError {
  readonly code = 'InvalidRequest';

  constructor(reason: string) {
    super(`Invalid staff member: ${reason}`);
  }
}

export class StaffMemberExists extends DomainError {
  readonly code = 'AlreadyRegistered';

  constructor() {
    super('A staff member with this e-mail already exists');
  }
}

/** Nobody changes their own role nor disables themselves (catalog: 403; task 7). */
export class StaffSelfChangeNotAllowed extends DomainError {
  readonly code = 'StaffSelfChangeNotAllowed';

  constructor() {
    super('A member never changes their own role nor disables themselves');
  }
}

/** The admin's screen never makes nor touches an admin (catalog: 403; G1, STF-14). */
export class AdminNotManaged extends DomainError {
  readonly code = 'AdminNotManaged';

  constructor() {
    super('An admin is neither created, changed nor disabled from the staff screen');
  }
}

/** A disabled member stays as it is (catalog: 409; G4). */
export class StaffMemberDisabled extends DomainError {
  readonly code = 'StaffMemberDisabled';

  constructor() {
    super('The staff member is disabled');
  }
}
