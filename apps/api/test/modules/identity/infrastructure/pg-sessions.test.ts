import { randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import {
  PgRefreshTokensRepository,
  PgSessionsRepository,
} from '../../../../src/modules/identity/infrastructure/pg-session-repositories.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import { uniqueEmail } from '../fixtures.ts';

// Session and refresh token queries against the real schema and the API role.
const pool = createPool(testDatabaseUrl());
const NOW = new Date('2026-10-06T12:00:00.000Z');

afterAll(async () => {
  await pool.end();
});

/** A user, a session and its first refresh token, inserted directly. */
async function seed(): Promise<{ sessionId: string; tokenId: string; tokenHash: Buffer }> {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const tokenId = randomUUID();
  const tokenHash = randomBytes(32);
  await pool.query(
    `INSERT INTO identity.users (id, name, cpf_ciphertext, cpf_hmac, cpf_masked, cpf_key_version,
       email, password_hash, status, created_at, updated_at)
     VALUES ($1, 'Maria Teste', $2, $3, '***.000.000-**', 1, $4, 'x', 'ACTIVE', now(), now())`,
    [userId, randomBytes(40), randomBytes(32), uniqueEmail()],
  );
  await pool.query(
    `INSERT INTO identity.sessions (id, user_id, device_label, created_at, last_used_at,
       idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, 'Pixel 8', $3, $3, $4, $5)`,
    [sessionId, userId, NOW, new Date('2026-10-13T12:00:00Z'), new Date('2026-11-05T12:00:00Z')],
  );
  await pool.query(
    `INSERT INTO identity.refresh_tokens (id, session_id, token_hash, created_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenId, sessionId, tokenHash, NOW],
  );
  return { sessionId, tokenId, tokenHash };
}

async function inTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function planOf(sql: string, params: unknown[]): Promise<string> {
  return inTransaction(async (client) => {
    await client.query('SET LOCAL enable_seqscan = off');
    const { rows } = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${sql}`, params);
    return rows.map((row) => row['QUERY PLAN']).join('\n');
  });
}

describe('PgRefreshTokensRepository', () => {
  it('finds a token by its hash, with its replacement state', async () => {
    const { sessionId, tokenId, tokenHash } = await seed();

    const found = await inTransaction((c) =>
      new PgRefreshTokensRepository(c).findByHash(tokenHash),
    );

    expect(found).toEqual({ id: tokenId, sessionId, replacedAt: null, replacedById: null });
  });

  it('returns null for a hash it does not know', async () => {
    await expect(
      inTransaction((c) => new PgRefreshTokensRepository(c).findByHash(randomBytes(32))),
    ).resolves.toBeNull();
  });

  it('marks a token replaced and finds the successor as the active one', async () => {
    const { sessionId, tokenId, tokenHash } = await seed();
    const successor = randomUUID();

    await inTransaction(async (c) => {
      const tokens = new PgRefreshTokensRepository(c);
      await tokens.markReplaced(tokenId, successor, NOW);
      await tokens.insert({ id: successor, sessionId, tokenHash: randomBytes(32), createdAt: NOW });
    });

    const [replaced, active] = await inTransaction(async (c) => {
      const tokens = new PgRefreshTokensRepository(c);
      return [await tokens.findByHash(tokenHash), await tokens.findActive(sessionId)] as const;
    });
    expect(replaced).toMatchObject({ replacedAt: NOW, replacedById: successor });
    expect(active).toBe(successor);
  });

  it('serves the lookups from their indexes', async () => {
    expect(await planOf(PgRefreshTokensRepository.FIND_BY_HASH_SQL, [randomBytes(32)])).toContain(
      'refresh_tokens_token_hash_key',
    );
    expect(await planOf(PgRefreshTokensRepository.FIND_ACTIVE_SQL, [randomUUID()])).toContain(
      'refresh_tokens_one_active_per_session',
    );
  });
});

describe('PgSessionsRepository', () => {
  it('locks a session and returns its state', async () => {
    const { sessionId } = await seed();

    const state = await inTransaction((c) => new PgSessionsRepository(c).lockById(sessionId));

    expect(state).toMatchObject({
      id: sessionId,
      deviceLabel: 'Pixel 8',
      createdAt: NOW,
      revokedAt: null,
      revokedReason: null,
    });
  });

  it('makes a second transaction wait for the lock (refreshes and logouts go one at a time)', async () => {
    const { sessionId } = await seed();
    const first = await pool.connect();
    try {
      await first.query('BEGIN');
      await new PgSessionsRepository(first).lockById(sessionId);

      let secondDone = false;
      const second = inTransaction(async (c) => {
        await new PgSessionsRepository(c).lockById(sessionId);
        secondDone = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(secondDone).toBe(false);

      await first.query('COMMIT');
      await second;
      expect(secondDone).toBe(true);
    } finally {
      first.release();
    }
  });

  it('saves the new expiration and the revocation', async () => {
    const { sessionId } = await seed();
    const later = new Date('2026-10-07T12:00:00Z');

    await inTransaction(async (c) => {
      const sessions = new PgSessionsRepository(c);
      const state = await sessions.lockById(sessionId);
      if (!state) throw new Error('seeded session not found');
      await sessions.update({
        ...state,
        lastUsedAt: later,
        idleExpiresAt: new Date('2026-10-14T12:00:00Z'),
        revokedAt: later,
        revokedReason: 'LOGOUT',
      });
    });

    const state = await inTransaction((c) => new PgSessionsRepository(c).lockById(sessionId));
    expect(state).toMatchObject({ lastUsedAt: later, revokedAt: later, revokedReason: 'LOGOUT' });
  });

  it('locks by primary key', async () => {
    expect(await planOf(PgSessionsRepository.LOCK_SQL, [randomUUID()])).toContain('sessions_pkey');
  });
});
