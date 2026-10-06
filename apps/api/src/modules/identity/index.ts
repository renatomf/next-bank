// Public API of the identity context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { ActiveSessions } from './application/active-sessions.ts';
import { CreatePin } from './application/create-pin.ts';
import { Login } from './application/login.ts';
import { Logout } from './application/logout.ts';
import type { AccessTokenVerifier } from './application/ports.ts';
import { RefreshSession } from './application/refresh-session.ts';
import { RegisterUser } from './application/register-user.ts';
import { AesGcmCpfProtector, type CpfKeys } from './infrastructure/aes-gcm-cpf-protector.ts';
import { Argon2idHasher } from './infrastructure/argon2id-hasher.ts';
import { loadCommonPasswords } from './infrastructure/common-password-file.ts';
import { InMemoryLoginAttempts } from './infrastructure/in-memory-login-attempts.ts';
import { type AccessTokenKeys, JoseAccessTokens } from './infrastructure/jose-access-tokens.ts';
import { PgIdentityRepositories } from './infrastructure/pg-identity-repositories.ts';
import { RandomRefreshTokens } from './infrastructure/random-refresh-tokens.ts';

export { AuthTokensSchema, authTokensBody } from './http/auth-tokens.ts';
export { registerAuthentication } from './http/authentication.ts';
export { loginRoutes } from './http/login-route.ts';
export { pinRoutes } from './http/pin-route.ts';
export { sessionRoutes } from './http/session-routes.ts';
export type { CpfKeys } from './infrastructure/aes-gcm-cpf-protector.ts';
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
  accessTokenVerifier: AccessTokenVerifier;
  activeSessions: ActiveSessions;
  createPin: CreatePin;
}

export interface IdentitySettings {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  accessTokenKeys: AccessTokenKeys;
  cpfKeys: CpfKeys;
  /** Server-side key mixed into PIN hashes (API-13). */
  pinPepper: Uint8Array;
}

/** Builds the identity context with its production adapters. */
export function createIdentityModule(settings: IdentitySettings): IdentityModule {
  const repositories = new PgIdentityRepositories();
  const hasher = new Argon2idHasher();
  const refreshTokens = new RandomRefreshTokens();
  const accessTokens = new JoseAccessTokens(settings.accessTokenKeys);
  return {
    registerUser: new RegisterUser({
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      hasher,
      cpfProtector: new AesGcmCpfProtector(settings.cpfKeys),
      commonPasswords: loadCommonPasswords(),
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
      attempts: new InMemoryLoginAttempts(),
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
    accessTokenVerifier: accessTokens,
    activeSessions: new ActiveSessions({ unitOfWork: settings.unitOfWork, repositories }),
    createPin: new CreatePin({
      unitOfWork: settings.unitOfWork,
      repositories,
      clock: settings.clock,
      ids: settings.ids,
      pinHasher: new Argon2idHasher({ pepper: settings.pinPepper }),
    }),
  };
}
