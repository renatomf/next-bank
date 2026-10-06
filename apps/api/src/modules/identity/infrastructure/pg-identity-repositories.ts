import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type { IdentityRepositories, IdentityRepositoriesFactory } from '../application/ports.ts';
import { PgRefreshTokensRepository, PgSessionsRepository } from './pg-session-repositories.ts';
import { PgUsersRepository } from './pg-users-repository.ts';

/** All identity repositories and the audit trail on the connection of the shared transaction. */
export class PgIdentityRepositories implements IdentityRepositoriesFactory {
  for(tx: Transaction): IdentityRepositories {
    const client = pgClientOf(tx);
    return {
      users: new PgUsersRepository(client),
      sessions: new PgSessionsRepository(client),
      refreshTokens: new PgRefreshTokensRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
