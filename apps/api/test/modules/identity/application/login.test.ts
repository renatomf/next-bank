import { describe, expect, it } from 'vitest';
import { Login } from '../../../../src/modules/identity/application/login.ts';
import { Cpf } from '../../../../src/modules/identity/domain/cpf.ts';
import {
  InvalidCredentials,
  TooManyAttempts,
} from '../../../../src/modules/identity/domain/errors.ts';
import {
  FakeAccessTokens,
  FakeHasher,
  FakeLoginAttemptsStore,
  FakeRefreshTokens,
  FixedClock,
  InMemoryDatabase,
  SequentialIds,
} from './fakes.ts';

// Login (ADR 0004, AUTH-01, AUTH-02, AUTH-03; domain-model.md 3.1 and 3.5).
const NOW = new Date('2026-10-06T12:00:00.000Z');
const PASSWORD = 'violet staple orbit 42'; // 22 characters: the fake hash is "hashed(22)"
const WRONG_PASSWORD = 'wrong password'; // another length, so the fake hasher refuses it
const EMAIL = 'maria@example.test';

function setup(status: 'ACTIVE' | 'LOCKED' = 'ACTIVE') {
  const db = new InMemoryDatabase();
  db.users.push({
    state: {
      id: 'user-1',
      name: 'Maria Teste',
      email: EMAIL,
      cpf: Cpf.parse('123.456.789-09'), // fictitious textbook CPF
      passwordHash: 'hashed(22)',
      status,
      createdAt: NOW,
    },
    cpf: { ciphertext: new Uint8Array(), blindIndex: new Uint8Array(), masked: '', keyVersion: 1 },
  });
  const hasher = new FakeHasher();
  const attempts = new FakeLoginAttemptsStore();
  const clock = new FixedClock(NOW);
  const login = new Login({
    unitOfWork: db,
    repositories: db,
    clock,
    ids: new SequentialIds(),
    hasher,
    refreshTokens: new FakeRefreshTokens(),
    accessTokens: new FakeAccessTokens(),
    attempts,
  });
  return { db, hasher, attempts, clock, login };
}

function attempt(password: string, email = EMAIL) {
  return { email, password, deviceLabel: 'Pixel 8', requestId: 'req-login-1' };
}

describe('Login', () => {
  it('opens a new session and returns its tokens, storing only the refresh token hash', async () => {
    const { db, login } = setup();

    const result = await login.execute(attempt(PASSWORD));

    expect(result).toEqual({
      accessToken: 'access(user-1,id-1)',
      accessTokenExpiresAt: new Date('2026-10-06T12:15:00.000Z'),
      refreshToken: 'refresh-token-value',
    });
    expect(db.sessions).toEqual([
      expect.objectContaining({ id: 'id-1', userId: 'user-1', deviceLabel: 'Pixel 8' }),
    ]);
    expect(JSON.stringify(db.refreshTokens)).not.toContain('refresh-token-value');
  });

  it('records LOGIN_SUCCEEDED and SESSION_CREATED with the request id', async () => {
    const { db, login } = setup();

    await login.execute(attempt(PASSWORD));

    expect(db.auditEvents.map((e) => [e.action, e.actorId, e.requestId])).toEqual([
      ['LOGIN_SUCCEEDED', 'user-1', 'req-login-1'],
      ['SESSION_CREATED', 'user-1', 'req-login-1'],
    ]);
  });

  it('opens a new session on every login, never reusing one (no session fixation)', async () => {
    const { db, login } = setup();

    await login.execute(attempt(PASSWORD));
    await login.execute(attempt(PASSWORD));

    expect(new Set(db.sessions.map((s) => s.id)).size).toBe(2);
  });

  it('finds the account however the e-mail is typed', async () => {
    const { login } = setup();

    await expect(login.execute(attempt(PASSWORD, '  Maria@Example.TEST '))).resolves.toBeDefined();
  });

  describe('refused logins (AUTH-02)', () => {
    it('refuses a wrong password and records LOGIN_FAILED, committed despite the error', async () => {
      const { db, login } = setup();

      await expect(login.execute(attempt(WRONG_PASSWORD))).rejects.toThrow(InvalidCredentials);

      expect(db.sessions).toEqual([]);
      expect(db.auditEvents).toEqual([
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          actorType: 'SYSTEM',
          actorId: null,
          subjectType: 'USER',
          subjectId: 'user-1',
          requestId: 'req-login-1',
          metadata: { reason: 'INVALID_PASSWORD' },
        }),
      ]);
    });

    it('refuses an unknown e-mail with the same error, after one verification against a dummy hash', async () => {
      const { db, hasher, login } = setup();

      await expect(login.execute(attempt(PASSWORD, 'nobody@example.test'))).rejects.toThrow(
        InvalidCredentials,
      );

      // Exactly one Argon2id verification, as for a known account: timing reveals nothing.
      expect(hasher.verified).toHaveLength(1);
      expect(hasher.verified[0]).not.toBe('hashed(22)');
      expect(db.auditEvents).toEqual([]);
    });

    it('verifies exactly once for a known account too', async () => {
      const { hasher, login } = setup();

      await expect(login.execute(attempt(WRONG_PASSWORD))).rejects.toThrow(InvalidCredentials);

      expect(hasher.verified).toEqual(['hashed(22)']);
    });

    it('refuses a locked account with the same error, after verifying the password', async () => {
      const { db, hasher, login } = setup('LOCKED');

      await expect(login.execute(attempt(PASSWORD))).rejects.toThrow(InvalidCredentials);

      expect(hasher.verified).toHaveLength(1);
      expect(db.sessions).toEqual([]);
      expect(db.auditEvents[0]?.metadata).toEqual({ reason: 'ACCOUNT_LOCKED' });
    });
  });

  describe('brute force (AUTH-01)', () => {
    it('blocks the 6th attempt within a minute without verifying any password', async () => {
      const { hasher, login } = setup();
      for (let i = 0; i < 5; i++) {
        await expect(login.execute(attempt(WRONG_PASSWORD))).rejects.toThrow(InvalidCredentials);
      }

      await expect(login.execute(attempt(PASSWORD))).rejects.toThrow(TooManyAttempts);
      expect(hasher.verified).toHaveLength(5);
    });

    it('lets at most 5 of 10 simultaneous wrong attempts verify a password (F-11)', async () => {
      const { hasher, login } = setup();

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => login.execute(attempt(WRONG_PASSWORD))),
      );

      // Each attempt is counted before its verification, so a burst cannot
      // slip past the per-account limit while the first ones are hashing.
      expect(hasher.verified).toHaveLength(5);
      const reasons = results.map((r): unknown => (r.status === 'rejected' ? r.reason : null));
      expect(reasons.filter((r) => r instanceof InvalidCredentials)).toHaveLength(5);
      expect(reasons.filter((r) => r instanceof TooManyAttempts)).toHaveLength(5);
    });

    it('counts attempts on unknown e-mails too, so blocking reveals nothing', async () => {
      const { login } = setup();
      for (let i = 0; i < 5; i++) {
        await expect(login.execute(attempt(PASSWORD, 'nobody@example.test'))).rejects.toThrow(
          InvalidCredentials,
        );
      }

      await expect(login.execute(attempt(PASSWORD, 'nobody@example.test'))).rejects.toThrow(
        TooManyAttempts,
      );
    });

    it('counts per account, however the e-mail is typed', async () => {
      const { login } = setup();
      for (let i = 0; i < 5; i++) {
        await expect(
          login.execute(attempt(WRONG_PASSWORD, `MARIA@example.test${' '.repeat(i)}`)),
        ).rejects.toThrow(InvalidCredentials);
      }

      await expect(login.execute(attempt(PASSWORD))).rejects.toThrow(TooManyAttempts);
    });

    it('starts over after a successful login', async () => {
      const { attempts, login } = setup();
      for (let i = 0; i < 4; i++) {
        await expect(login.execute(attempt(WRONG_PASSWORD))).rejects.toThrow(InvalidCredentials);
      }

      await login.execute(attempt(PASSWORD));

      expect(attempts.entries.size).toBe(0);
    });

    it('lets the account try again once the block is over', async () => {
      const { clock, login } = setup();
      for (let i = 0; i < 5; i++) {
        await expect(login.execute(attempt(WRONG_PASSWORD))).rejects.toThrow(InvalidCredentials);
      }

      clock.current = new Date(NOW.getTime() + 60_000);

      await expect(login.execute(attempt(PASSWORD))).resolves.toBeDefined();
    });
  });
});
