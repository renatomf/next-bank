// Public API of the identity context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { Login } from './application/login.ts';
import { Logout } from './application/logout.ts';
import type { AccessTokenVerifier } from './application/ports.ts';
import { RefreshSession } from './application/refresh-session.ts';
import { UserRegistration } from './application/user-registration.ts';
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
export { sessionRoutes } from './http/session-routes.ts';
export type { CpfKeys } from './infrastructure/aes-gcm-cpf-protector.ts';
export type { AccessTokenKeys } from './infrastructure/jose-access-tokens.ts';
export type {
  PreparedRegistration,
  RegisteredUser,
  RegistrationInput,
} from './application/user-registration.ts';

/** The registration steps an orchestrator sequences (ADR 0010). */
export type IdentityRegistration = Pick<
  UserRegistration,
  'prepare' | 'register' | 'issueAccessToken'
>;

export interface IdentityModule {
  registration: IdentityRegistration;
  login: Login;
  refreshSession: RefreshSession;
  logout: Logout;
  accessTokenVerifier: AccessTokenVerifier;
}

export interface IdentitySettings {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  accessTokenKeys: AccessTokenKeys;
  cpfKeys: CpfKeys;
}

/** Builds the identity context with its production adapters. */
export function createIdentityModule(settings: IdentitySettings): IdentityModule {
  const repositories = new PgIdentityRepositories();
  const hasher = new Argon2idHasher();
  const refreshTokens = new RandomRefreshTokens();
  const accessTokens = new JoseAccessTokens(settings.accessTokenKeys);
  return {
    registration: new UserRegistration({
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
  };
}
