import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { InMemoryLoginAttempts } from '../../shared/infrastructure/in-memory-login-attempts.ts';
import { AuthenticateStaff } from './application/authenticate-staff.ts';
import { CreateStaffMember } from './application/create-staff-member.ts';
import { ChangeStaffRole, DisableStaffMember, ListStaff } from './application/manage-staff.ts';
import type { SecretHasher, SessionTokens } from './application/ports.ts';
import { StaffLogin } from './application/staff-login.ts';
import { StaffDirectory } from './application/staff-directory.ts';
import { StaffLogout } from './application/staff-logout.ts';
import { AesGcmSecretBox } from './infrastructure/aes-gcm-secret-box.ts';
import { OtpauthTotp } from './infrastructure/otpauth-totp.ts';
import { PgStaffRepositories } from './infrastructure/pg-staff-repositories.ts';

export { registerStaffAuthentication, staffCallerOf } from './http/staff-authentication.ts';
export { assertAllowed } from './domain/permissions.ts';
export { staffAuthRoutes } from './http/staff-auth-routes.ts';
export { staffManagementRoutes } from './http/staff-management-routes.ts';
export type { StaffCaller } from './application/authenticate-staff.ts';
export type { CreatedStaffMember } from './application/create-staff-member.ts';
export type { StaffDirectory } from './application/staff-directory.ts';
export type { StaffRole } from './domain/permissions.ts';

export interface StaffModule {
  login: StaffLogin;
  logout: StaffLogout;
  authenticate: AuthenticateStaff;
  createMember: CreateStaffMember;
  /** The admin's screen of the staff (v1.3.0, task 7). */
  listStaff: ListStaff;
  changeStaffRole: ChangeStaffRole;
  disableStaffMember: DisableStaffMember;
  /** Implements the StaffNamesPort of Operations (v1.3.0, task 4). */
  directory: StaffDirectory;
}

export interface StaffSettings {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  /** Seals the TOTP secrets (STAFF_TOTP_KEY, S5). */
  totpKey: Uint8Array;
  /** Argon2id, the same as the customers' passwords. */
  hasher: SecretHasher;
  /** Random 256-bit tokens, the same as the customers' refresh tokens. */
  tokens: SessionTokens;
}

/** The staff of the backoffice (v1.3.0 plan, task 1): its own context, apart from Identity (B4). */
export function createStaffModule(settings: StaffSettings): StaffModule {
  const repositories = new PgStaffRepositories();
  const totp = new OtpauthTotp();
  const secrets = new AesGcmSecretBox(settings.totpKey);
  const shared = {
    unitOfWork: settings.unitOfWork,
    repositories,
    clock: settings.clock,
    ids: settings.ids,
  };
  return {
    login: new StaffLogin({
      ...shared,
      hasher: settings.hasher,
      totp,
      secrets,
      tokens: settings.tokens,
      // Apart from the customers' counters: the same e-mail is never both.
      attempts: new InMemoryLoginAttempts(),
    }),
    logout: new StaffLogout(shared),
    authenticate: new AuthenticateStaff({ ...shared, tokens: settings.tokens }),
    createMember: new CreateStaffMember({
      ...shared,
      hasher: settings.hasher,
      totp,
      secrets,
      tokens: settings.tokens,
    }),
    directory: new StaffDirectory(repositories),
    listStaff: new ListStaff(shared),
    changeStaffRole: new ChangeStaffRole(shared),
    disableStaffMember: new DisableStaffMember(shared),
  };
}
