import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The database is the last barrier: identity invariants also hold here
// (database.md, sections 1 and 5.1).
describe('identity schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insertUser(overrides: Record<string, unknown> = {}): Promise<string> {
    const user = {
      id: randomUUID(),
      name: 'Maria Teste',
      cpf_ciphertext: randomBytes(40),
      cpf_hmac: randomBytes(32),
      cpf_masked: '***.456.789-**',
      email: `user-${randomUUID()}@example.test`,
      status: 'ACTIVE',
      ...overrides,
    };
    await app.query(
      `INSERT INTO identity.users
         (id, name, cpf_ciphertext, cpf_hmac, cpf_masked, cpf_key_version, email,
          password_hash, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6, '$argon2id$fake', $7, now(), now())`,
      [
        user.id,
        user.name,
        user.cpf_ciphertext,
        user.cpf_hmac,
        user.cpf_masked,
        user.email,
        user.status,
      ],
    );
    return user.id;
  }

  async function insertSession(userId: string, overrides: Record<string, unknown> = {}) {
    const session = {
      id: randomUUID(),
      created_at: new Date('2026-10-06T12:00:00Z'),
      idle_expires_at: new Date('2026-10-13T12:00:00Z'),
      absolute_expires_at: new Date('2026-11-05T12:00:00Z'),
      revoked_at: null,
      revoked_reason: null,
      ...overrides,
    };
    await app.query(
      `INSERT INTO identity.sessions
         (id, user_id, created_at, last_used_at, idle_expires_at, absolute_expires_at,
          revoked_at, revoked_reason)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7)`,
      [
        session.id,
        userId,
        session.created_at,
        session.idle_expires_at,
        session.absolute_expires_at,
        session.revoked_at,
        session.revoked_reason,
      ],
    );
    return session.id;
  }

  async function insertRefreshToken(sessionId: string): Promise<string> {
    const id = randomUUID();
    await app.query(
      `INSERT INTO identity.refresh_tokens (id, session_id, token_hash, created_at)
       VALUES ($1, $2, $3, now())`,
      [id, sessionId, randomBytes(32)],
    );
    return id;
  }

  describe('users', () => {
    it('rejects a second user with the same CPF (T-DB-11)', async () => {
      const cpfHmac = randomBytes(32);
      await insertUser({ cpf_hmac: cpfHmac });

      await expect(insertUser({ cpf_hmac: cpfHmac })).rejects.toThrow(/users_cpf_hmac_key/);
    });

    it('rejects a second user with the same e-mail', async () => {
      const email = `same-${randomUUID()}@example.test`;
      await insertUser({ email });

      await expect(insertUser({ email })).rejects.toThrow(/users_email_key/);
    });

    it('stores e-mails only in lowercase', async () => {
      await expect(insertUser({ email: 'Maria@Example.test' })).rejects.toThrow(
        /users_email_check/,
      );
    });

    it('accepts only names between 2 and 120 characters', async () => {
      await expect(insertUser({ name: 'M' })).rejects.toThrow(/users_name_check/);
      await expect(insertUser({ name: 'M'.repeat(121) })).rejects.toThrow(/users_name_check/);
    });

    it('accepts only known statuses', async () => {
      await expect(insertUser({ status: 'DELETED' })).rejects.toThrow(/users_status_check/);
    });

    it('accepts only a 32-byte CPF blind index', async () => {
      await expect(insertUser({ cpf_hmac: randomBytes(16) })).rejects.toThrow(
        /users_cpf_hmac_check/,
      );
    });

    it('cannot be deleted by the API role', async () => {
      const id = await insertUser();

      await expect(app.query('DELETE FROM identity.users WHERE id = $1', [id])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe('sessions', () => {
    it('must expire after it was created', async () => {
      const userId = await insertUser();

      await expect(
        insertSession(userId, {
          idle_expires_at: new Date('2026-10-06T11:00:00Z'),
          absolute_expires_at: new Date('2026-10-06T11:00:00Z'),
        }),
      ).rejects.toThrow(/sessions_absolute_expires_at_check/);
    });

    it('never outlives its absolute expiration through inactivity', async () => {
      const userId = await insertUser();

      await expect(
        insertSession(userId, { idle_expires_at: new Date('2026-12-01T12:00:00Z') }),
      ).rejects.toThrow(/sessions_idle_expires_at_check/);
    });

    it('records a known reason whenever it is revoked', async () => {
      const userId = await insertUser();
      const revokedAt = new Date('2026-10-06T13:00:00Z');

      await expect(insertSession(userId, { revoked_at: revokedAt })).rejects.toThrow(
        /sessions_revoked_reason_check/,
      );
      await expect(
        insertSession(userId, { revoked_at: revokedAt, revoked_reason: 'BORED' }),
      ).rejects.toThrow(/sessions_revoked_reason_check/);
      await expect(
        insertSession(userId, { revoked_at: revokedAt, revoked_reason: 'LOGOUT' }),
      ).resolves.toBeDefined();
    });

    it('belongs to an existing user', async () => {
      await expect(insertSession(randomUUID())).rejects.toThrow(/sessions_user_id_fkey/);
    });
  });

  describe('refresh_tokens', () => {
    it('rejects a duplicated token hash', async () => {
      const sessionId = await insertSession(await insertUser());
      const hash = randomBytes(32);
      const insert = () =>
        app.query(
          `INSERT INTO identity.refresh_tokens (id, session_id, token_hash, created_at)
           VALUES ($1, $2, $3, now())`,
          [randomUUID(), sessionId, hash],
        );
      await insert();

      await expect(insert()).rejects.toThrow(/refresh_tokens_token_hash_key/);
    });

    it('records the replacement together with the time it happened', async () => {
      const sessionId = await insertSession(await insertUser());
      const oldToken = await insertRefreshToken(sessionId);

      await expect(
        app.query('UPDATE identity.refresh_tokens SET replaced_at = now() WHERE id = $1', [
          oldToken,
        ]),
      ).rejects.toThrow(/refresh_tokens_replaced_check/);
    });

    it('can be deleted by the cleanup job', async () => {
      const sessionId = await insertSession(await insertUser());
      const token = await insertRefreshToken(sessionId);

      const result = await app.query('DELETE FROM identity.refresh_tokens WHERE id = $1', [token]);
      expect(result.rowCount).toBe(1);
    });

    // Last barrier for rotation (AUTH-03): whatever the code does, a session never
    // has two tokens that can be refreshed.
    it('allows only one active token per session', async () => {
      const sessionId = await insertSession(await insertUser());
      await insertRefreshToken(sessionId);

      await expect(insertRefreshToken(sessionId)).rejects.toThrow(
        /refresh_tokens_one_active_per_session/,
      );
    });

    it('rotates in one transaction: replace the old token, then insert its successor', async () => {
      const sessionId = await insertSession(await insertUser());
      const oldToken = await insertRefreshToken(sessionId);
      const newToken = randomUUID();

      await app.query('BEGIN');
      try {
        // The successor does not exist yet: the reference is checked at commit.
        await app.query(
          'UPDATE identity.refresh_tokens SET replaced_at = now(), replaced_by_id = $2 WHERE id = $1',
          [oldToken, newToken],
        );
        await app.query(
          `INSERT INTO identity.refresh_tokens (id, session_id, token_hash, created_at)
           VALUES ($1, $2, $3, now())`,
          [newToken, sessionId, randomBytes(32)],
        );
        await app.query('COMMIT');
      } catch (error) {
        await app.query('ROLLBACK');
        throw error;
      }

      const { rows } = await app.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM identity.refresh_tokens
         WHERE session_id = $1 AND replaced_at IS NULL`,
        [sessionId],
      );
      expect(rows[0]?.n).toBe(1);
    });

    it('still refuses a replacement pointing to a token that never appears', async () => {
      const sessionId = await insertSession(await insertUser());
      const oldToken = await insertRefreshToken(sessionId);

      await app.query('BEGIN');
      try {
        await app.query(
          'UPDATE identity.refresh_tokens SET replaced_at = now(), replaced_by_id = $2 WHERE id = $1',
          [oldToken, randomUUID()],
        );
        await expect(app.query('COMMIT')).rejects.toThrow(/refresh_tokens_replaced_by_id_fkey/);
      } finally {
        // Leaves the shared connection clean whatever happened above.
        await app.query('ROLLBACK');
      }
    });
  });

  describe('transaction_pins', () => {
    it('allows at most 5 failed attempts', async () => {
      const userId = await insertUser();
      await app.query(
        `INSERT INTO identity.transaction_pins (user_id, pin_hash, failed_attempts, updated_at)
         VALUES ($1, '$argon2id$fake', 0, now())`,
        [userId],
      );

      await expect(
        app.query('UPDATE identity.transaction_pins SET failed_attempts = 6 WHERE user_id = $1', [
          userId,
        ]),
      ).rejects.toThrow(/transaction_pins_failed_attempts_check/);
    });

    it('keeps at most the two most recent locks and no timed lock once a reset is required', async () => {
      const userId = await insertUser();
      const insertPin = (recentLocks: Date[], resetRequired: boolean, lockedUntil: Date | null) =>
        app.query(
          `INSERT INTO identity.transaction_pins
             (user_id, pin_hash, failed_attempts, locked_until, recent_locks, reset_required, updated_at)
           VALUES ($1, '$argon2id$fake', 5, $2, $3, $4, now())`,
          [userId, lockedUntil, recentLocks, resetRequired],
        );
      const now = new Date('2026-10-06T12:00:00Z');

      await expect(insertPin([now, now, now], false, null)).rejects.toThrow(
        /transaction_pins_recent_locks_check/,
      );
      await expect(insertPin([now, now], true, now)).rejects.toThrow(
        /transaction_pins_reset_required_check/,
      );
      await expect(insertPin([now, now], true, null)).resolves.toBeDefined();
    });
  });

  it('keeps trigger and helper functions out of reach of the API role', async () => {
    const { rows } = await app.query<{ name: string }>(
      `SELECT p.oid::regprocedure::text AS name FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname IN ('identity', 'audit')
         AND has_function_privilege('nextbank_app', p.oid, 'EXECUTE')`,
    );
    expect(rows).toEqual([]);
  });
});
