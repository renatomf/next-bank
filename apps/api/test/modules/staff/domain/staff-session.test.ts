import { describe, expect, it } from 'vitest';
import { StaffSessionExpired } from '../../../../src/modules/staff/domain/errors.ts';
import { StaffSession } from '../../../../src/modules/staff/domain/staff-session.ts';

// A staff session (v1.3.0 plan, task 1; STF-06): it ends after 15 minutes
// without use, after 8 hours whatever the use, or when revoked.
const OPENED = new Date('2026-11-02T12:00:00.000Z');
const minutes = (n: number) => new Date(OPENED.getTime() + n * 60_000);

const open = () => StaffSession.open({ id: 'session-1', memberId: 'member-1', now: OPENED });

describe('StaffSession', () => {
  it('opens usable, ending 8 hours later at most', () => {
    const session = open();

    expect(session.state).toEqual({
      id: 'session-1',
      memberId: 'member-1',
      createdAt: OPENED,
      lastSeenAt: OPENED,
      expiresAt: minutes(8 * 60),
      revokedAt: null,
    });
    expect(() => {
      session.assertUsable(minutes(14));
    }).not.toThrow();
  });

  it('ends after 15 minutes without use', () => {
    expect(() => {
      open().assertUsable(minutes(15));
    }).toThrow(StaffSessionExpired);
  });

  it('stays usable while it is used', () => {
    const session = open();
    for (let at = 10; at <= 100; at += 10) session.touch(minutes(at));

    expect(() => {
      session.assertUsable(minutes(110));
    }).not.toThrow();
    expect(session.state.lastSeenAt).toEqual(minutes(100));
  });

  it('ends after 8 hours, however much it is used', () => {
    const session = open();
    for (let at = 10; at < 8 * 60; at += 10) session.touch(minutes(at));

    expect(() => {
      session.assertUsable(minutes(8 * 60));
    }).toThrow(StaffSessionExpired);
  });

  it('ends at once when revoked', () => {
    const session = open();
    session.revoke(minutes(1));

    expect(session.state.revokedAt).toEqual(minutes(1));
    expect(() => {
      session.assertUsable(minutes(2));
    }).toThrow(StaffSessionExpired);
  });

  it('is never touched back to life, nor revoked twice', () => {
    const session = open();
    session.revoke(minutes(1));

    expect(() => {
      session.touch(minutes(2));
    }).toThrow(StaffSessionExpired);
    session.revoke(minutes(3));
    expect(session.state.revokedAt).toEqual(minutes(1));
  });
});
