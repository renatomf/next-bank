// Public API of the identity context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { ActiveSessions } from './application/active-sessions.ts';
import { ChangePassword } from './application/change-password.ts';
import { ChangePin } from './application/change-pin.ts';
import { CreatePin } from './application/create-pin.ts';
import { GetProfile } from './application/get-profile.ts';
import { ListSessions } from './application/list-sessions.ts';
import { Login } from './application/login.ts';
import { Logout } from './application/logout.ts';
import { PayeeDirectory } from './application/payee-directory.ts';
import type { AccessTokenVerifier } from './application/ports.ts';
import { RefreshSession } from './application/refresh-session.ts';
import { RegisterUser } from './application/register-user.ts';
import { RevokeSession } from './application/revoke-session.ts';
import { VerifyPin } from './application/verify-pin.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { AesGcmCpfProtector } from './infrastructure/aes-gcm-cpf-protector.ts';
import { Argon2idHasher } from './infrastructure/argon2id-hasher.ts';
import { loadCommonPasswords } from './infrastructure/common-password-file.ts';
import { InMemoryLoginAttempts } from './infrastructure/in-memory-login-attempts.ts';
import { type AccessTokenKeys, JoseAccessTokens } from './infrastructure/jose-access-tokens.ts';
import { PgIdentityRepositories } from './infrastructure/pg-identity-repositories.ts';
import { RandomRefreshTokens } from './infrastructure/random-refresh-tokens.ts';

export { AuthTokensSchema, authTokensBody } from './http/auth-tokens.ts';
export { callerOf, registerAuthentication } from './http/authentication.ts';
export { loginRoutes } from './http/login-route.ts';
export { mePasswordRoutes } from './http/me-password-route.ts';
export { meRoutes } from './http/me-route.ts';
export { meSessionsRoutes } from './http/me-sessions-routes.ts';
export { pinRoutes } from './http/pin-route.ts';
export { sessionRoutes } from './http/session-routes.ts';
export type { PayeeDirectory } from './application/payee-directory.ts';
export type { AccessTokenKeys } from './infrastructure/jose-access-tokens.ts';
export type {
  PreparedRegistration,
  RegisteredUser,
  RegistrationInput,
} from './application/register-user.ts';

/** The registration steps an orchestrator sequences (ADR 0010). */
export type RegisterUserSteps = Pick<RegisterUser, 'prepare' | 'register' | 'issueAccessToken'>;

export interface IdentityModule {
  registerUser: RegisterUserSteps;
  login: Login;
  refreshSession: RefreshSession;
  logout: Logout;
  listSessions: ListSessions;
  revokeSession: RevokeSession;
  accessTokenVerifier: AccessTokenVerifier;
  activeSessions: ActiveSessions;
  createPin: CreatePin;
  verifyPin: VerifyPin;
  changePin: ChangePin;
  changePassword: ChangePassword;
  getProfile: GetProfile;
  /** Implements the IdentityPort of Payments. */
  payees: PayeeDirectory;
}

export interface IdentitySettings {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  accessTokenKeys: AccessTokenKeys;
  piiKeys: PiiKeys;
  /** Server-side key mixed into PIN hashes (API-13). */
  pinPepper: Uint8Array;
}

/** Builds the identity context with its production adapters. */
export function createIdentityModule(settings: IdentitySettings): IdentityModule {
  const repositories = new PgIdentityRepositories();
  const hasher = new Argon2idHasher();
  const refreshTokens = new RandomRefreshTokens();
  const accessTokens = new JoseAccessTokens(settings.accessTokenKeys);
  const pinHasher = new Argon2idHasher({ pepper: settings.pinPepper });
  // One counter for every check of the password: login, PIN change (AUTH-01).
  const loginAttempts = new InMemoryLoginAttempts();
  const commonPasswords = loadCommonPasswords();
  return {
    registerUser: new RegisterUser({
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      hasher,
      cpfProtector: new AesGcmCpfProtector(settings.piiKeys),
      commonPasswords,
      refreshTokens,
      accessTokens,
    }),
    login: new Login({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      hasher,
      refreshTokens,
      accessTokens,
      attempts: loginAttempts,
    }),
    refreshSession: new RefreshSession({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      refreshTokens,
      accessTokens,
    }),
    logout: new Logout({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
    }),
    listSessions: new ListSessions({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
    }),
    revokeSession: new RevokeSession({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
    }),
    accessTokenVerifier: accessTokens,
    activeSessions: new ActiveSessions({ unitOfWork: settings.unitOfWork, repositories }),
    createPin: new CreatePin({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      pinHasher,
    }),
    verifyPin: new VerifyPin({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      pinHasher,
    }),
    changePin: new ChangePin({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      hasher,
      pinHasher,
      attempts: loginAttempts,
    }),
    changePassword: new ChangePassword({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      hasher,
      attempts: loginAttempts,
      commonPasswords,
    }),
    getProfile: new GetProfile({ unitOfWork: settings.unitOfWork, repositories }),
    payees: new PayeeDirectory(repositories),
  };
}
