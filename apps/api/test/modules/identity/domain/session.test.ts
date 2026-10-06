import { describe, expect, it } from 'vitest';
import { SessionExpired } from '../../../../src/modules/identity/domain/errors.ts';
import {
  type IssuedRefreshToken,
  Session,
} from '../../../../src/modules/identity/domain/session.ts';

// Session rules (ADR 0004, domain-model.md 3.1, AUTH-03, AUTH-06).
const START = new Date('2026-10-06T12:00:00.000Z');
const SECOND = 1_000;
const DAY = 24 * 60 * 60 * SECOND;

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

function newSession(): Session {
  return Session.create({ id: 'session-1', userId: 'user-1', deviceLabel: 'Pixel 8', now: START });
}

function token(overrides: Partial<IssuedRefreshToken> = {}): IssuedRefreshToken {
  return {
    id: 'token-1',
    sessionId: 'session-1',
    replacedAt: null,
    replacedById: null,
    ...overrides,
  };
}

describe('Session', () => {
  describe('create', () => {
    it('lasts 7 days without use and 30 days at most', () => {
      const session = newSession();

      expect(session.state).toMatchObject({
        id: 'session-1',
        userId: 'user-1',
        deviceLabel: 'Pixel 8',
        createdAt: START,
        lastUsedAt: START,
        idleExpiresAt: at(7 * DAY),
        absoluteExpiresAt: at(30 * DAY),
        revokedAt: null,
        revokedReason: null,
      });
    });
  });

  describe('refresh', () => {
    it('rotates the presented token when it is the current one', () => {
      const session = newSession();

      const result = session.refresh(token(), at(DAY));

      expect(result).toEqual({ outcome: 'ROTATED', replacedTokenId: 'token-1' });
    });

    it('extends the inactivity limit from the moment of use', () => {
      const session = newSession();

      session.refresh(token(), at(DAY));

      expect(session.state.lastUsedAt).toEqual(at(DAY));
      expect(session.state.idleExpiresAt).toEqual(at(8 * DAY));
    });

    it('never extends beyond the absolute limit', () => {
      const session = newSession();

      session.refresh(token(), at(25 * DAY));

      expect(session.state.idleExpiresAt).toEqual(at(30 * DAY));
    });

    it('refuses after 7 days without use (SessionExpired)', () => {
      const session = newSession();

      expect(() => session.refresh(token(), at(7 * DAY))).toThrow(SessionExpired);
    });

    it('refuses after 30 days even if used every day (SessionExpired)', () => {
      const session = newSession();
      for (let day = 1; day < 30; day++) session.refresh(token(), at(day * DAY));

      expect(() => session.refresh(token(), at(30 * DAY))).toThrow(SessionExpired);
    });

    it('refuses once revoked, for example after logout (AUTH-06)', () => {
      const session = newSession();
      session.revoke('LOGOUT', at(SECOND));

      expect(() => session.refresh(token(), at(2 * SECOND))).toThrow(SessionExpired);
    });

    describe('presenting a token that was already replaced', () => {
      const replacedAt = at(DAY);
      const replaced = token({ replacedAt, replacedById: 'token-2' });

      it('rotates again from the active token within 10 s (response lost on the network)', () => {
        const session = newSession();

        const result = session.refresh(replaced, at(DAY + 10 * SECOND), 'token-2');

        expect(result).toEqual({ outcome: 'ROTATED', replacedTokenId: 'token-2' });
        expect(session.state.revokedAt).toBeNull();
      });

      it('revokes the whole session after 10 s: the token was stolen (AUTH-03)', () => {
        const session = newSession();
        const now = at(DAY + 10 * SECOND + 1);

        const result = session.refresh(replaced, now, 'token-2');

        expect(result).toEqual({ outcome: 'REUSE_DETECTED' });
        expect(session.state).toMatchObject({
          revokedAt: now,
          revokedReason: 'REFRESH_TOKEN_REUSE',
        });
      });

      it('revokes within 10 s when the chain has already moved on', () => {
        const session = newSession();

        const result = session.refresh(replaced, at(DAY + SECOND), 'token-3');

        expect(result).toEqual({ outcome: 'REUSE_DETECTED' });
        expect(session.state.revokedReason).toBe('REFRESH_TOKEN_REUSE');
      });

      it('revokes within 10 s when the session has no active token', () => {
        const session = newSession();

        const result = session.refresh(replaced, at(DAY + SECOND), null);

        expect(result).toEqual({ outcome: 'REUSE_DETECTED' });
      });
    });

    it('rejects a token from another session as a programming error', () => {
      const session = newSession();

      expect(() => session.refresh(token({ sessionId: 'session-2' }), at(SECOND))).toThrow(
        /another session/,
      );
    });
  });

  describe('revoke', () => {
    it('records when and why', () => {
      const session = newSession();

      session.revoke('PASSWORD_CHANGED', at(SECOND));

      expect(session.state).toMatchObject({
        revokedAt: at(SECOND),
        revokedReason: 'PASSWORD_CHANGED',
      });
      expect(session.isActive(at(2 * SECOND))).toBe(false);
    });

    it('keeps the first reason when revoked twice', () => {
      const session = newSession();
      session.revoke('REFRESH_TOKEN_REUSE', at(SECOND));

      session.revoke('LOGOUT', at(2 * SECOND));

      expect(session.state).toMatchObject({
        revokedAt: at(SECOND),
        revokedReason: 'REFRESH_TOKEN_REUSE',
      });
    });
  });

  describe('isActive', () => {
    it('is active until either limit is reached', () => {
      const session = newSession();

      expect(session.isActive(at(7 * DAY - 1))).toBe(true);
      expect(session.isActive(at(7 * DAY))).toBe(false);
    });
  });

  it('can be restored from storage with the same state', () => {
    const original = newSession();
    original.refresh(token(), at(DAY));

    const restored = Session.restore(original.state);

    expect(restored.state).toEqual(original.state);
    expect(restored.state).not.toBe(original.state);
  });
});
