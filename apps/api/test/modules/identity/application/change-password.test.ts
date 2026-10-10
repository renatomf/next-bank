import { describe, expect, it } from 'vitest';
import { ChangePassword } from '../../../../src/modules/identity/application/change-password.ts';
import { PasswordIncorrect, WeakPassword } from '../../../../src/modules/identity/domain/errors.ts';
import type { SessionState } from '../../../../src/modules/identity/domain/session.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import {
  FakeHasher,
  FakeLoginAttemptsStore,
  FixedClock,
  InMemoryDatabase,
  SequentialIds,
} from './fakes.ts';

// The password changes with the current one and ends every other session
// (ASVS; AUTH-06; week 7 plan, D4). The user and the current session come
// from the token.
const NOW = new Date('2026-10-09T12:00:00.000Z');
// The fake hasher matches by length: this password hashes to "hashed(22)".
const PASSWORD = 'violet staple orbit 42';
const NEW_PASSWORD = 'amber kettle ridge 77 and more';

function session(id: string, changes: Partial<SessionState> = {}): SessionState {
  return {
    id,
    userId: 'ana',
    deviceLabel: null,
    createdAt: new Date(NOW.getTime() - 3_600_000),
    lastUsedAt: NOW,
    idleExpiresAt: new Date(NOW.getTime() + 600_000),
    absoluteExpiresAt: new Date(NOW.getTime() + 36_000_000),
    revokedAt: null,
    revokedReason: null,
    ...changes,
  };
}

function setup() {
  const db = new InMemoryDatabase();
  db.users.push({
    state: {
      id: 'ana',
      name: 'Ana Teste',
      email: 'ana@example.test',
      cpf: Cpf.parse('123.456.789-09'), // fictitious textbook CPF
      passwordHash: 'hashed(22)',
      status: 'ACTIVE',
      createdAt: NOW,
    },
    cpf: { ciphertext: new Uint8Array(), blindIndex: new Uint8Array(), masked: '', keyVersion: 1 },
  });
  db.sessions = [
    session('current'),
    session('phone'),
    session('laptop'),
    session('bruno', { userId: 'bruno' }),
  ];
  const hasher = new FakeHasher();
  const attempts = new FakeLoginAttemptsStore();
  const changePassword = new ChangePassword({
    unitOfWork: db,
    repositories: db,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    hasher,
    attempts,
    commonPasswords: { contains: (candidate) => candidate === 'password123' },
  });
  return { db, hasher, attempts, changePassword };
}

const input = {
  userId: 'ana',
  sessionId: 'current',
  currentPassword: PASSWORD,
  newPassword: NEW_PASSWORD,
  requestId: 'req-1',
};

describe('ChangePassword', () => {
  it('stores the hash of the new password', async () => {
    const { db, hasher, changePassword } = setup();

    await changePassword.execute(input);

    expect(hasher.hashed).toEqual([NEW_PASSWORD]);
    expect(db.users[0]?.state.passwordHash).toBe(`hashed(${String(NEW_PASSWORD.length)})`);
  });

  // AUTH-06: every other session of the caller ends; others' are untouched.
  it('ends every other session of the caller and keeps the current one', async () => {
    const { db, changePassword } = setup();

    await changePassword.execute(input);

    const byId = new Map(db.sessions.map((s) => [s.id, s]));
    expect(byId.get('current')?.revokedAt).toBeNull();
    for (const id of ['phone', 'laptop']) {
      expect(byId.get(id)?.revokedAt).toEqual(NOW);
      expect(byId.get(id)?.revokedReason).toBe('PASSWORD_CHANGED');
    }
    expect(byId.get('bruno')?.revokedAt).toBeNull();
  });

  it('records the change and each ended session', async () => {
    const { db, changePassword } = setup();

    await changePassword.execute(input);

    expect(db.auditEvents.map((event) => [event.action, event.subjectId, event.metadata])).toEqual([
      ['SESSION_REVOKED', 'laptop', { reason: 'PASSWORD_CHANGED' }],
      ['SESSION_REVOKED', 'phone', { reason: 'PASSWORD_CHANGED' }],
      ['PASSWORD_CHANGED', 'ana', { endedSessions: 2 }],
    ]);
  });

  it('refuses a wrong current password, changing nothing, and counts it', async () => {
    const { db, attempts, changePassword } = setup();

    await expect(
      changePassword.execute({ ...input, currentPassword: 'wrong' }),
    ).rejects.toBeInstanceOf(PasswordIncorrect);

    expect(db.users[0]?.state.passwordHash).toBe('hashed(22)');
    expect(db.sessions.every((s) => s.revokedAt === null)).toBe(true);
    expect(attempts.get('ana@example.test')?.recentFailures).toHaveLength(1);
  });

  // AUTH-07: the policy of the registration, checked before any attempt counts.
  for (const newPassword of ['short', 'password123']) {
    it(`refuses the weak new password "${newPassword}" before checking the current one`, async () => {
      const { hasher, attempts, changePassword } = setup();

      await expect(changePassword.execute({ ...input, newPassword })).rejects.toBeInstanceOf(
        WeakPassword,
      );
      expect(hasher.verified).toEqual([]);
      expect(attempts.entries.size).toBe(0);
    });
  }
});
