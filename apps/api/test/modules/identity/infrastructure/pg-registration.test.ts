import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { RegisterCustomer } from '../../../../src/application/onboarding/register-customer.ts';
import { UserRegistration } from '../../../../src/modules/identity/application/user-registration.ts';
import { Cpf } from '../../../../src/modules/identity/domain/cpf.ts';
import { AlreadyRegistered } from '../../../../src/modules/identity/domain/errors.ts';
import { AesGcmCpfProtector } from '../../../../src/modules/identity/infrastructure/aes-gcm-cpf-protector.ts';
import { PgIdentityRepositories } from '../../../../src/modules/identity/infrastructure/pg-identity-repositories.ts';
import { PgUsersRepository } from '../../../../src/modules/identity/infrastructure/pg-users-repository.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import {
  FakeAccessTokens,
  FakeHasher,
  FakeRefreshTokens,
  FixedClock,
} from '../application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// Registration against the real schema and the API role (CLAUDE.md, section 5):
// queries that do not match the schema, grants or constraints fail here.
const NOW = new Date('2026-10-06T12:00:00.000Z');
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);
const repositories = new PgIdentityRepositories();

function newRegister() {
  const identity = new UserRegistration({
    repositories,
    clock: new FixedClock(NOW),
    ids: new UuidV7Generator(),
    hasher: new FakeHasher(),
    cpfProtector: new AesGcmCpfProtector({
      keyVersion: 1,
      encryptionKey: randomBytes(32),
      hmacKey: Buffer.alloc(32, 7),
    }),
    commonPasswords: { contains: () => false },
    refreshTokens: new FakeRefreshTokensWithUniqueHash(),
    accessTokens: new FakeAccessTokens(),
  });
  return new RegisterCustomer({ unitOfWork, identity });
}

/** The real token hash is unique per token; the database enforces it. */
class FakeRefreshTokensWithUniqueHash extends FakeRefreshTokens {
  override generate() {
    return { token: 'refresh-token-value', hash: randomBytes(32) };
  }
}

function input(overrides: { email?: string; cpf?: string } = {}) {
  return {
    name: 'Maria Teste',
    email: overrides.email ?? uniqueEmail(),
    cpf: overrides.cpf ?? fictitiousCpf(),
    password: 'violet staple orbit 42',
    deviceLabel: 'Pixel 8',
    requestId: 'req-integration-1',
  };
}

async function usersWithEmail(email: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM identity.users WHERE email = $1',
    [email],
  );
  return rows[0]?.n ?? 0;
}

afterAll(async () => {
  await pool.end();
});

describe('registration on Postgres through the shared unit of work', () => {
  it('stores the user with the CPF encrypted, the session, the token hash and the audit trail', async () => {
    const data = input();
    const result = await newRegister().execute(data);

    const { rows: users } = await pool.query<{
      email: string;
      cpf_ciphertext: Buffer;
      cpf_masked: string;
      cpf_key_version: number;
      status: string;
    }>(
      `SELECT email, cpf_ciphertext, cpf_masked, cpf_key_version, status
       FROM identity.users WHERE id = $1`,
      [result.userId],
    );
    expect(users).toHaveLength(1);
    expect(users[0]?.status).toBe('ACTIVE');
    expect(users[0]?.cpf_ciphertext.includes(Buffer.from(data.cpf))).toBe(false);
    expect(users[0]?.cpf_masked).toMatch(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/);

    const { rows: tokens } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM identity.refresh_tokens WHERE session_id = $1',
      [result.sessionId],
    );
    expect(tokens[0]?.n).toBe(1);

    const { rows: events } = await pool.query<{ action: string; request_id: string }>(
      `SELECT action, request_id FROM audit.audit_events
       WHERE subject_id IN ($1, $2) ORDER BY action`,
      [result.userId, result.sessionId],
    );
    expect(events).toEqual([
      { action: 'SESSION_CREATED', request_id: 'req-integration-1' },
      { action: 'USER_REGISTERED', request_id: 'req-integration-1' },
    ]);
  });

  it('rolls everything back when the work fails midway', async () => {
    const email = uniqueEmail();

    await expect(
      unitOfWork.run(async (tx) => {
        await repositories.for(tx).users.insert(
          {
            id: '01990000-0000-7000-8000-000000000001',
            name: 'Maria Teste',
            email,
            cpf: Cpf.parse(fictitiousCpf()),
            passwordHash: 'x',
            status: 'ACTIVE',
            createdAt: NOW,
          },
          {
            ciphertext: randomBytes(40),
            blindIndex: randomBytes(32),
            masked: '***.000.000-**',
            keyVersion: 1,
          },
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await usersWithEmail(email)).toBe(0);
  });

  it('refuses an e-mail that already has an account and keeps a single user', async () => {
    const email = uniqueEmail();
    await newRegister().execute(input({ email }));

    await expect(newRegister().execute(input({ email }))).rejects.toThrow(AlreadyRegistered);
    expect(await usersWithEmail(email)).toBe(1);
  });

  it('lets only one of two simultaneous registrations with the same e-mail succeed', async () => {
    const email = uniqueEmail();

    const results = await Promise.allSettled([
      newRegister().execute(input({ email })),
      newRegister().execute(input({ email })),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(AlreadyRegistered);
    expect(await usersWithEmail(email)).toBe(1);
  });
});

describe('PgUsersRepository', () => {
  async function insertTwice(change: 'email' | 'cpf') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const users = new PgUsersRepository(client);
      const email = uniqueEmail();
      const blindIndex = randomBytes(32);
      const user = (id: string, sameEmail: boolean) => ({
        id,
        name: 'Maria Teste',
        email: sameEmail ? email : uniqueEmail(),
        cpf: Cpf.parse(fictitiousCpf()),
        passwordHash: 'x',
        status: 'ACTIVE' as const,
        createdAt: NOW,
      });
      const cpf = (sameCpf: boolean) => ({
        ciphertext: randomBytes(40),
        blindIndex: sameCpf ? blindIndex : randomBytes(32),
        masked: '***.000.000-**',
        keyVersion: 1,
      });
      await users.insert(user('01990000-0000-7000-8000-00000000000a', true), cpf(true));
      await users.insert(
        user('01990000-0000-7000-8000-00000000000b', change === 'email'),
        cpf(change === 'cpf'),
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  // The unique constraints are the final word when two requests race (T-DB-11).
  it.each(['email', 'cpf'] as const)(
    'turns a unique violation on %s into AlreadyRegistered',
    async (change) => {
      await expect(insertTwice(change)).rejects.toThrow(AlreadyRegistered);
    },
  );

  it('answers the existence check from the unique indexes, not a table scan', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Tiny test tables make a sequential scan cheaper; turning it off shows
      // whether an index can serve the query at all.
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN ${PgUsersRepository.EXISTS_SQL}`,
        [uniqueEmail(), randomBytes(32)],
      );
      const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('users_email_key');
      expect(plan).toContain('users_cpf_hmac_key');
      expect(plan).not.toMatch(/Seq Scan/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('PgUsersRepository.findByEmail (login)', () => {
  it('returns the id, password hash and status of the account', async () => {
    const email = uniqueEmail();
    const { userId } = await newRegister().execute(input({ email }));
    const client = await pool.connect();
    try {
      const found = await new PgUsersRepository(client).findByEmail(email);

      expect(found).toEqual({
        id: userId,
        passwordHash: expect.any(String) as string,
        status: 'ACTIVE',
      });
    } finally {
      client.release();
    }
  });

  it('returns null for an unknown e-mail', async () => {
    const client = await pool.connect();
    try {
      await expect(new PgUsersRepository(client).findByEmail(uniqueEmail())).resolves.toBeNull();
    } finally {
      client.release();
    }
  });

  it('is served by the unique e-mail index', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN ${PgUsersRepository.FIND_BY_EMAIL_SQL}`,
        [uniqueEmail()],
      );
      const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
      expect(plan).toContain('users_email_key');
      expect(plan).not.toMatch(/Seq Scan/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
