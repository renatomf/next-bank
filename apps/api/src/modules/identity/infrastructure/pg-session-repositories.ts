import type pg from 'pg';
import type {
  RefreshTokensRepository,
  SessionsRepository,
  StoredRefreshToken,
} from '../application/ports.ts';
import type { IssuedRefreshToken, RevokedReason, SessionState } from '../domain/session.ts';

interface SessionRow {
  id: string;
  user_id: string;
  device_label: string | null;
  created_at: Date;
  last_used_at: Date;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  revoked_reason: RevokedReason | null;
}

export class PgSessionsRepository implements SessionsRepository {
  /** Served by sessions_pkey; the row stays locked until the transaction ends. */
  static readonly LOCK_SQL = `SELECT id, user_id, device_label, created_at, last_used_at,
      idle_expires_at, absolute_expires_at, revoked_at, revoked_reason
    FROM identity.sessions WHERE id = $1 FOR UPDATE`;

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

  async lockById(id: string): Promise<SessionState | null> {
    const { rows } = await this.#client.query<SessionRow>(PgSessionsRepository.LOCK_SQL, [id]);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          userId: row.user_id,
          deviceLabel: row.device_label,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
          idleExpiresAt: row.idle_expires_at,
          absoluteExpiresAt: row.absolute_expires_at,
          revokedAt: row.revoked_at,
          revokedReason: row.revoked_reason,
        }
      : null;
  }

  /** Only what a session can change: its use, its expiration and its revocation. */
  async update(session: SessionState): Promise<void> {
    await this.#client.query(
      `UPDATE identity.sessions
       SET last_used_at = $2, idle_expires_at = $3, revoked_at = $4, revoked_reason = $5
       WHERE id = $1`,
      [
        session.id,
        session.lastUsedAt,
        session.idleExpiresAt,
        session.revokedAt,
        session.revokedReason,
      ],
    );
  }
}

export class PgRefreshTokensRepository implements RefreshTokensRepository {
  /** Served by refresh_tokens_token_hash_key. */
  static readonly FIND_BY_HASH_SQL = `SELECT id, session_id, replaced_at, replaced_by_id
    FROM identity.refresh_tokens WHERE token_hash = $1`;

  /** Served by the partial unique index refresh_tokens_one_active_per_session. */
  static readonly FIND_ACTIVE_SQL = `SELECT id FROM identity.refresh_tokens
    WHERE session_id = $1 AND replaced_at IS NULL`;

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

  async findByHash(tokenHash: Uint8Array): Promise<IssuedRefreshToken | null> {
    const { rows } = await this.#client.query<{
      id: string;
      session_id: string;
      replaced_at: Date | null;
      replaced_by_id: string | null;
    }>(PgRefreshTokensRepository.FIND_BY_HASH_SQL, [Buffer.from(tokenHash)]);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          sessionId: row.session_id,
          replacedAt: row.replaced_at,
          replacedById: row.replaced_by_id,
        }
      : null;
  }

  async findActive(sessionId: string): Promise<string | null> {
    const { rows } = await this.#client.query<{ id: string }>(
      PgRefreshTokensRepository.FIND_ACTIVE_SQL,
      [sessionId],
    );
    return rows[0]?.id ?? null;
  }

  async markReplaced(id: string, replacedById: string, replacedAt: Date): Promise<void> {
    await this.#client.query(
      `UPDATE identity.refresh_tokens SET replaced_at = $3, replaced_by_id = $2 WHERE id = $1`,
      [id, replacedById, replacedAt],
    );
  }
}
