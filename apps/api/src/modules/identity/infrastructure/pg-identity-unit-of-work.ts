import type pg from 'pg';
import { withTransaction } from '../../../shared/infrastructure/pg-transaction.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type { IdentityTransaction, IdentityUnitOfWork } from '../application/ports.ts';
import { PgRefreshTokensRepository, PgSessionsRepository } from './pg-session-repositories.ts';
import { PgUsersRepository } from './pg-users-repository.ts';

/** All repositories share one connection, so the use case commits or rolls back as a whole. */
export class PgIdentityUnitOfWork implements IdentityUnitOfWork {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  run<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T> {
    return withTransaction(this.#pool, (client) =>
      work({
        users: new PgUsersRepository(client),
        sessions: new PgSessionsRepository(client),
        refreshTokens: new PgRefreshTokensRepository(client),
        audit: new PgAuditTrail(client),
      }),
    );
  }
}
