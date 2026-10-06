import type pg from 'pg';
import type {
  RefreshTokensRepository,
  SessionsRepository,
  StoredRefreshToken,
} from '../application/ports.ts';
import type { SessionState } from '../domain/session.ts';

export class PgSessionsRepository implements SessionsRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(session: SessionState): Promise<void> {
    await this.#client.query(
      `INSERT INTO identity.sessions
         (id, user_id, device_label, created_at, last_used_at, idle_expires_at,
          absolute_expires_at, revoked_at, revoked_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        session.id,
        session.userId,
        session.deviceLabel,
        session.createdAt,
        session.lastUsedAt,
        session.idleExpiresAt,
        session.absoluteExpiresAt,
        session.revokedAt,
        session.revokedReason,
      ],
    );
  }
}

export class PgRefreshTokensRepository implements RefreshTokensRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(token: StoredRefreshToken): Promise<void> {
    await this.#client.query(
      `INSERT INTO identity.refresh_tokens (id, session_id, token_hash, created_at)
       VALUES ($1, $2, $3, $4)`,
      [token.id, token.sessionId, Buffer.from(token.tokenHash), token.createdAt],
    );
  }
}
