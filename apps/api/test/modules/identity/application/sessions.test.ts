import { describe, expect, it } from 'vitest';
import { ListSessions } from '../../../../src/modules/identity/application/list-sessions.ts';
import { RevokeSession } from '../../../../src/modules/identity/application/revoke-session.ts';
import { CurrentSessionNotRevocable } from '../../../../src/modules/identity/domain/errors.ts';
import type { SessionState } from '../../../../src/modules/identity/domain/session.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, InMemoryDatabase, SequentialIds } from './fakes.ts';

// The customer sees and ends their own sessions (ASVS session; week 7 plan,
// D3). The user and the current session come from the token.
const NOW = new Date('2026-10-09T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

function session(id: string, changes: Partial<SessionState> = {}): SessionState {
  return {
    id,
    userId: 'ana',
    deviceLabel: null,
    createdAt: minutes(-60),
    lastUsedAt: minutes(-10),
    idleExpiresAt: minutes(20),
    absoluteExpiresAt: minutes(600),
    revokedAt: null,
    revokedReason: null,
    ...changes,
  };
}

function setup(sessions: SessionState[]) {
  const db = new InMemoryDatabase();
  db.sessions = sessions;
  const clock = new FixedClock(NOW);
  return {
    db,
    list: new ListSessions({ unitOfWork: db, repositories: db, clock }),
    revoke: new RevokeSession({
      unitOfWork: db,
      repositories: db,
      clock,
      ids: new SequentialIds(),
    }),
  };
}

describe('ListSessions', () => {
  it('lists the active sessions of the caller, newest use first', async () => {
    const { list } = setup([
      session('phone', { deviceLabel: 'Android 15', lastUsedAt: minutes(-1) }),
      session('laptop', { lastUsedAt: minutes(-30) }),
    ]);

    const sessions = await list.execute({ userId: 'ana', sessionId: 'laptop' });

    expect(sessions).toEqual([
      {
        id: 'phone',
        deviceLabel: 'Android 15',
        createdAt: minutes(-60),
        lastUsedAt: minutes(-1),
        current: false,
      },
      {
        id: 'laptop',
        deviceLabel: null,
        createdAt: minutes(-60),
        lastUsedAt: minutes(-30),
        current: true,
      },
    ]);
  });

  it('leaves out ended, expired and other customers sessions', async () => {
    const { list } = setup([
      session('mine'),
      session('revoked', { revokedAt: minutes(-5), revokedReason: 'LOGOUT' }),
      session('idle', { idleExpiresAt: minutes(-1) }),
      session('old', { absoluteExpiresAt: minutes(-1) }),
      session('bruno', { userId: 'bruno' }),
    ]);

    const sessions = await list.execute({ userId: 'ana', sessionId: 'mine' });

    expect(sessions.map((s) => s.id)).toEqual(['mine']);
  });
});

describe('RevokeSession', () => {
  it('ends another session of the caller and records it', async () => {
    const { db, revoke } = setup([session('phone'), session('laptop')]);

    await revoke.execute({
      userId: 'ana',
      currentSessionId: 'laptop',
      sessionId: 'phone',
      requestId: 'req-1',
    });

    const phone = db.sessions.find((s) => s.id === 'phone');
    expect(phone?.revokedAt).toEqual(NOW);
    expect(phone?.revokedReason).toBe('LOGOUT');
    expect(db.auditEvents).toEqual([
      expect.objectContaining({
        action: 'SESSION_REVOKED',
        actorId: 'ana',
        subjectId: 'phone',
        requestId: 'req-1',
        metadata: { reason: 'LOGOUT', by: 'ANOTHER_SESSION' },
      }),
    ]);
  });

  // IDOR: another customer's session answers like one that does not exist.
  for (const [name, sessions] of [
    ['of another customer', [session('bruno-phone', { userId: 'bruno' })]],
    ['that does not exist', []],
    [
      'that already ended',
      [session('bruno-phone', { revokedAt: minutes(-5), revokedReason: 'LOGOUT' })],
    ],
    ['that expired', [session('bruno-phone', { idleExpiresAt: minutes(-1) })]],
  ] as const) {
    it(`does not find a session ${name}`, async () => {
      const { db, revoke } = setup([...sessions]);

      await expect(
        revoke.execute({
          userId: 'ana',
          currentSessionId: 'laptop',
          sessionId: 'bruno-phone',
          requestId: null,
        }),
      ).rejects.toBeInstanceOf(NotFound);
      expect(db.auditEvents).toEqual([]);
    });
  }

  // D3: the current session ends by signing out.
  it('refuses the session of the token itself', async () => {
    const { db, revoke } = setup([session('laptop')]);

    await expect(
      revoke.execute({
        userId: 'ana',
        currentSessionId: 'laptop',
        sessionId: 'laptop',
        requestId: null,
      }),
    ).rejects.toBeInstanceOf(CurrentSessionNotRevocable);
    expect(db.sessions[0]?.revokedAt).toBeNull();
  });
});
