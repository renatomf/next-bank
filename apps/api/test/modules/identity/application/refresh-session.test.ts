import { describe, expect, it } from 'vitest';
import { Logout } from '../../../../src/modules/identity/application/logout.ts';
import { RefreshSession } from '../../../../src/modules/identity/application/refresh-session.ts';
import {
  RefreshTokenReuseDetected,
  SessionExpired,
} from '../../../../src/modules/identity/domain/errors.ts';
import { Session } from '../../../../src/modules/identity/domain/session.ts';
import {
  FakeAccessTokens,
  FixedClock,
  InMemoryDatabase,
  SequentialIds,
  SequentialRefreshTokens,
} from './fakes.ts';

// Refresh and logout (ADR 0004, AUTH-03, AUTH-06, D5).
const START = new Date('2026-10-06T12:00:00.000Z');
const SECOND = 1_000;
const DAY = 24 * 60 * 60 * SECOND;

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

/** A session opened at START with its first refresh token, "refresh-0". */
function setup() {
  const db = new InMemoryDatabase();
  const clock = new FixedClock(START);
  const session = Session.create({
    id: 'session-1',
    userId: 'user-1',
    deviceLabel: null,
    now: START,
  });
  db.sessions.push(session.state);
  db.refreshTokens.push({
    id: 'token-0',
    sessionId: 'session-1',
    tokenHash: new TextEncoder().encode('hash-of-refresh-0'),
    createdAt: START,
  });
  const refreshTokens = new SequentialRefreshTokens();
  const deps = { unitOfWork: db, repositories: db, clock, ids: new SequentialIds() };
  const refresh = new RefreshSession({
    ...deps,
    refreshTokens,
    accessTokens: new FakeAccessTokens(),
  });
  const logout = new Logout(deps);
  return { db, clock, refresh, logout };
}

function refreshWith(token: string) {
  return { refreshToken: token, requestId: 'req-refresh-1' };
}

describe('RefreshSession', () => {
  it('rotates: returns a new pair and the presented token stops being active', async () => {
    const { db, clock, refresh } = setup();
    clock.current = at(DAY);

    const result = await refresh.execute(refreshWith('refresh-0'));

    expect(result).toEqual({
      accessToken: 'access(user-1,session-1)',
      accessTokenExpiresAt: new Date(at(DAY).getTime() + 15 * 60 * SECOND),
      refreshToken: 'refresh-1',
    });
    expect(db.replacements.get('token-0')).toEqual({ replacedAt: at(DAY), replacedById: 'id-1' });
    expect(db.refreshTokens.at(-1)).toMatchObject({ id: 'id-1', sessionId: 'session-1' });
    expect(db.sessions[0]).toMatchObject({ lastUsedAt: at(DAY), idleExpiresAt: at(8 * DAY) });
  });

  it('refuses a malformed token without opening a transaction (SessionExpired)', async () => {
    const { db, refresh } = setup();

    await expect(refresh.execute(refreshWith('not-a-token'))).rejects.toThrow(SessionExpired);
    expect(db.runs).toBe(0);
  });

  it('refuses a token it never issued (SessionExpired)', async () => {
    const { refresh } = setup();

    await expect(refresh.execute(refreshWith('refresh-999'))).rejects.toThrow(SessionExpired);
  });

  it('refuses after 7 days without use and writes nothing (SessionExpired, D5)', async () => {
    const { db, clock, refresh } = setup();
    clock.current = at(7 * DAY);

    await expect(refresh.execute(refreshWith('refresh-0'))).rejects.toThrow(SessionExpired);
    expect(db.replacements.size).toBe(0);
  });

  it('answers a lost response retried within 10 s with a new pair (grace window)', async () => {
    const { db, clock, refresh } = setup();
    clock.current = at(DAY);
    await refresh.execute(refreshWith('refresh-0'));

    clock.current = at(DAY + 10 * SECOND);
    const retried = await refresh.execute(refreshWith('refresh-0'));

    expect(retried.refreshToken).toBe('refresh-2');
    expect(db.sessions[0]?.revokedAt).toBeNull();
  });

  describe('a replaced token presented after 10 s (AUTH-03)', () => {
    async function reuse() {
      const context = setup();
      context.clock.current = at(DAY);
      await context.refresh.execute(refreshWith('refresh-0'));
      context.clock.current = at(DAY + 11 * SECOND);
      await expect(context.refresh.execute(refreshWith('refresh-0'))).rejects.toThrow(
        RefreshTokenReuseDetected,
      );
      return context;
    }

    it('revokes the whole session, committed despite the error', async () => {
      const { db } = await reuse();

      expect(db.sessions[0]).toMatchObject({
        revokedAt: at(DAY + 11 * SECOND),
        revokedReason: 'REFRESH_TOKEN_REUSE',
      });
    });

    it('records REFRESH_REUSE_DETECTED and SESSION_REVOKED with the request id', async () => {
      const { db } = await reuse();

      expect(db.auditEvents.map((e) => [e.action, e.subjectId, e.requestId, e.metadata])).toEqual([
        ['REFRESH_REUSE_DETECTED', 'session-1', 'req-refresh-1', {}],
        ['SESSION_REVOKED', 'session-1', 'req-refresh-1', { reason: 'REFRESH_TOKEN_REUSE' }],
      ]);
    });

    it('also refuses the active token afterwards: the session is gone', async () => {
      const { refresh } = await reuse();

      await expect(refresh.execute(refreshWith('refresh-1'))).rejects.toThrow(SessionExpired);
    });
  });
});

describe('Logout', () => {
  const caller = { userId: 'user-1', sessionId: 'session-1', requestId: 'req-logout-1' };

  it('revokes the session and records SESSION_REVOKED (AUTH-06)', async () => {
    const { db, logout } = setup();

    await logout.execute(caller);

    expect(db.sessions[0]).toMatchObject({ revokedAt: START, revokedReason: 'LOGOUT' });
    expect(db.auditEvents).toEqual([
      expect.objectContaining({
        action: 'SESSION_REVOKED',
        actorType: 'USER',
        actorId: 'user-1',
        subjectType: 'SESSION',
        subjectId: 'session-1',
        requestId: 'req-logout-1',
        metadata: { reason: 'LOGOUT' },
      }),
    ]);
  });

  it('makes the refresh token useless (AUTH-06)', async () => {
    const { logout, refresh } = setup();

    await logout.execute(caller);

    await expect(refresh.execute(refreshWith('refresh-0'))).rejects.toThrow(SessionExpired);
  });

  it('is idempotent: a second logout changes and records nothing', async () => {
    const { db, logout } = setup();
    await logout.execute(caller);

    await logout.execute(caller);

    expect(db.auditEvents).toHaveLength(1);
  });

  it('does nothing for a session that is not the caller’s', async () => {
    const { db, logout } = setup();

    await logout.execute({ ...caller, userId: 'user-2' });

    expect(db.sessions[0]?.revokedAt).toBeNull();
    expect(db.auditEvents).toEqual([]);
  });
});
