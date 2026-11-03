import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The staff's tables (v1.3.0 plan, task 1): members with a role and a
// status, and their sessions, stored only as the hash of the token. The API
// moves only what a login and a session change, and deletes nothing.
describe('staff schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insertMember(columns: Record<string, unknown> = {}): Promise<string> {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      email: `${randomUUID()}@example.com`,
      name: 'Lia Operadora',
      password_hash: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
      totp_secret_ciphertext: randomBytes(64),
      totp_key_version: 1,
      last_totp_step: null,
      role: 'OPERATOR',
      status: 'ACTIVE',
      is_demo: false,
      created_at: new Date('2026-11-02T12:00:00Z'),
      updated_at: new Date('2026-11-02T12:00:00Z'),
      ...columns,
    };
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO staff.members (${names.join(', ')})
       VALUES (${names.map((_, i) => `$${String(i + 1)}`).join(', ')})`,
      Object.values(row),
    );
    return String(row.id);
  }

  async function insertSession(memberId: string, columns: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      member_id: memberId,
      token_hash: randomBytes(32),
      created_at: new Date('2026-11-02T12:00:00Z'),
      last_seen_at: new Date('2026-11-02T12:00:00Z'),
      expires_at: new Date('2026-11-02T20:00:00Z'),
      revoked_at: null,
      ...columns,
    };
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO staff.sessions (${names.join(', ')})
       VALUES (${names.map((_, i) => `$${String(i + 1)}`).join(', ')})`,
      Object.values(row),
    );
    return String(row.id);
  }

  it('takes a member and its session', async () => {
    await expect(insertSession(await insertMember())).resolves.toBeTypeOf('string');
  });

  it.each([
    ['an unknown role', { role: 'ROOT' }],
    ['an unknown status', { status: 'GONE' }],
    ['an e-mail in capitals', { email: 'Lia@Example.com' }],
    ['a name of one letter', { name: 'L' }],
    ['no TOTP secret', { totp_secret_ciphertext: null }],
    ['a key version of 0', { totp_key_version: 0 }],
    ['a negative TOTP step', { last_totp_step: -1 }],
  ])('refuses a member with %s', async (_case, columns) => {
    await expect(insertMember(columns)).rejects.toThrow();
  });

  it('keeps one member per e-mail', async () => {
    const email = `${randomUUID()}@example.com`;
    await insertMember({ email });

    await expect(insertMember({ email })).rejects.toThrow(/duplicate key/);
  });

  it.each([
    ['a token hash that is not 32 bytes', { token_hash: randomBytes(16) }],
    ['an end before its start', { expires_at: new Date('2026-11-02T11:00:00Z') }],
    ['a use before its start', { last_seen_at: new Date('2026-11-02T11:00:00Z') }],
    ['a life over 8 hours', { expires_at: new Date('2026-11-02T20:00:01Z') }],
    ['a revocation before its start', { revoked_at: new Date('2026-11-02T11:00:00Z') }],
  ])('refuses a session with %s', async (_case, columns) => {
    await expect(insertSession(await insertMember(), columns)).rejects.toThrow();
  });

  it('keeps one session per token hash', async () => {
    const member = await insertMember();
    const tokenHash = randomBytes(32);
    await insertSession(member, { token_hash: tokenHash });

    await expect(insertSession(member, { token_hash: tokenHash })).rejects.toThrow(/duplicate key/);
  });

  it('lets the API move only the last code, the role, the status and the session, and delete nothing', async () => {
    const member = await insertMember();
    const session = await insertSession(member);

    await expect(
      app.query('UPDATE staff.members SET last_totp_step = 5, updated_at = now() WHERE id = $1', [
        member,
      ]),
    ).resolves.toBeDefined();
    // The admin's screen (task 7): a role and a status, never the credentials.
    await expect(
      app.query(
        "UPDATE staff.members SET role = 'ANALYST', status = 'DISABLED', updated_at = now() WHERE id = $1",
        [member],
      ),
    ).resolves.toBeDefined();
    await expect(
      app.query(
        `UPDATE staff.sessions
         SET last_seen_at = created_at + interval '1 minute',
             revoked_at = created_at + interval '2 minutes'
         WHERE id = $1`,
        [session],
      ),
    ).resolves.toBeDefined();
    for (const change of [
      "UPDATE staff.members SET email = 'x@example.com' WHERE id = $1",
      'UPDATE staff.members SET is_demo = true WHERE id = $1',
      "UPDATE staff.members SET password_hash = 'x' WHERE id = $1",
      'UPDATE staff.members SET totp_secret_ciphertext = NULL WHERE id = $1',
      'DELETE FROM staff.members WHERE id = $1',
    ]) {
      await expect(app.query(change, [member])).rejects.toThrow(/permission denied/);
    }
    await expect(app.query('DELETE FROM staff.sessions WHERE id = $1', [session])).rejects.toThrow(
      /permission denied/,
    );
  });
});
