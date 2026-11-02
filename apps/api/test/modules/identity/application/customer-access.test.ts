import { describe, expect, it } from 'vitest';
import { CustomerAccess } from '../../../../src/modules/identity/application/customer-access.ts';
import { Session } from '../../../../src/modules/identity/domain/session.ts';
import { FixedClock, InMemoryDatabase, SequentialIds, storedUser } from './fakes.ts';

// A blocked customer loses access at once (v1.3.0 plan, task 4; K1, F-12):
// the customer is LOCKED and every session still alive is revoked, in the
// caller's transaction, each revocation audited with the staff member as
// the actor.
const NOW = new Date('2026-11-02T15:00:00.000Z');

function setup() {
  const db = new InMemoryDatabase();
  db.users.push(storedUser({ id: 'user-1', status: 'ACTIVE' }));
  for (const id of ['session-b', 'session-a']) {
    db.sessions.push(Session.create({ id, userId: 'user-1', deviceLabel: null, now: NOW }).state);
  }
  const ended = Session.create({
    id: 'session-old',
    userId: 'user-1',
    deviceLabel: null,
    now: NOW,
  });
  ended.revoke('LOGOUT', NOW);
  db.sessions.push(ended.state);
  const access = new CustomerAccess({ repositories: db, ids: new SequentialIds() });
  return { db, access, clock: new FixedClock(NOW) };
}

const lockOut = { userId: 'user-1', actorId: 'staff-1', requestId: 'req-1', now: NOW };

describe('CustomerAccess.lockOut', () => {
  it('locks the customer and revokes every live session', async () => {
    const { db, access } = setup();

    await db.run((tx) => access.lockOut(tx, lockOut));

    expect(db.users[0]?.state.status).toBe('LOCKED');
    expect(
      db.sessions.map(({ id, revokedAt, revokedReason }) => [id, revokedAt, revokedReason]),
    ).toEqual([
      ['session-b', NOW, 'ACCOUNT_BLOCKED'],
      ['session-a', NOW, 'ACCOUNT_BLOCKED'],
      // An ended session keeps the reason it ended for.
      ['session-old', NOW, 'LOGOUT'],
    ]);
  });

  it('audits each revocation with the staff member as the actor', async () => {
    const { db, access } = setup();

    await db.run((tx) => access.lockOut(tx, lockOut));

    expect(
      db.auditEvents.map((event) => [
        event.action,
        event.actorType,
        event.actorId,
        event.subjectId,
      ]),
    ).toEqual([
      ['SESSION_REVOKED', 'STAFF', 'staff-1', 'session-a'],
      ['SESSION_REVOKED', 'STAFF', 'staff-1', 'session-b'],
    ]);
    expect(db.auditEvents[0]?.metadata).toEqual({ reason: 'ACCOUNT_BLOCKED' });
  });
});

describe('CustomerAccess.restore', () => {
  it('unlocks the customer, who signs in again with a new session', async () => {
    const { db, access } = setup();
    await db.run((tx) => access.lockOut(tx, lockOut));

    await db.run((tx) => access.restore(tx, { userId: 'user-1', now: NOW }));

    expect(db.users[0]?.state.status).toBe('ACTIVE');
    // The revoked sessions stay revoked: unblocking opens no door by itself.
    expect(db.sessions.every((session) => session.revokedAt !== null)).toBe(true);
  });
});
