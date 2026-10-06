// Public API of the identity context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator } from '../../shared/application/ports.ts';
import { UserRegistration } from './application/user-registration.ts';
import { AesGcmCpfProtector, type CpfKeys } from './infrastructure/aes-gcm-cpf-protector.ts';
import { Argon2idHasher } from './infrastructure/argon2id-hasher.ts';
import { loadCommonPasswords } from './infrastructure/common-password-file.ts';
import { type AccessTokenKeys, JoseAccessTokens } from './infrastructure/jose-access-tokens.ts';
import { PgIdentityRepositories } from './infrastructure/pg-identity-repositories.ts';
import { RandomRefreshTokens } from './infrastructure/random-refresh-tokens.ts';

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
}

export interface IdentitySettings {
  clock: Clock;
  ids: IdGenerator;
  accessTokenKeys: AccessTokenKeys;
  cpfKeys: CpfKeys;
}

/** Builds the identity context with its production adapters. */
export function createIdentityModule(settings: IdentitySettings): IdentityModule {
  return {
    registration: new UserRegistration({
      repositories: new PgIdentityRepositories(),
      clock: settings.clock,
      ids: settings.ids,
      hasher: new Argon2idHasher(),
      cpfProtector: new AesGcmCpfProtector(settings.cpfKeys),
      commonPasswords: loadCommonPasswords(),
      refreshTokens: new RandomRefreshTokens(),
      accessTokens: new JoseAccessTokens(settings.accessTokenKeys),
    }),
  };
}
