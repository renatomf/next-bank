import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { StaffMember } from '../../../../src/modules/staff/domain/staff-member.ts';
import { StaffSession } from '../../../../src/modules/staff/domain/staff-session.ts';
import { PgStaffRepositories } from '../../../../src/modules/staff/infrastructure/pg-staff-repositories.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { testDatabaseUrl } from '../../../helpers.ts';

// The staff's sessions on the real Postgres (v1.3.0 plan, task 1; STF-06;
// F-46). A request reads its session without a lock and writes back its last
// use; if the logout revoked the session in between, that late write must
// not bring it back.
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);
const repositories = new PgStaffRepositories();
const OPENED = new Date('2026-11-02T12:00:00.000Z');
const minutes = (n: number) => new Date(OPENED.getTime() + n * 60_000);

afterAll(async () => {
  await pool.end();
});

async function openSession(): Promise<StaffSession> {
  const member = StaffMember.create({
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    name: 'Lia Operadora',
    role: 'OPERATOR',
    isDemo: false,
    now: OPENED,
  });
  const session = StaffSession.open({ id: randomUUID(), memberId: member.state.id, now: OPENED });
  await unitOfWork.run(async (tx) => {
    const staff = repositories.for(tx);
    await staff.members.insert({
      state: member.state,
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc$def',
      totpSecret: { ciphertext: randomBytes(64), keyVersion: 1 },
    });
    await staff.sessions.insert(session.state, randomBytes(32));
  });
  return session;
}

const revokedAtOf = async (id: string) =>
  unitOfWork.run(async (tx) => (await repositories.for(tx).sessions.lock(id))?.revokedAt);

describe('PgStaffRepositories, the sessions', () => {
  it('never brings back a session revoked while a request was using it (F-46)', async () => {
    const session = await openSession();
    // The request read the session before the logout...
    const readByTheRequest = StaffSession.restore(session.state);
    // ...the logout revokes it...
    const revoked = StaffSession.restore(session.state);
    revoked.revoke(minutes(1));
    await unitOfWork.run((tx) => repositories.for(tx).sessions.update(revoked.state));
    // ...and the request writes back its last use, from what it had read.
    readByTheRequest.touch(minutes(2));
    await unitOfWork.run((tx) => repositories.for(tx).sessions.update(readByTheRequest.state));

    expect(await revokedAtOf(session.state.id)).toEqual(minutes(1));
  });

  it('keeps the first revocation when revoked twice', async () => {
    const session = await openSession();
    const first = StaffSession.restore(session.state);
    first.revoke(minutes(1));
    const second = StaffSession.restore(session.state);
    second.revoke(minutes(3));

    await unitOfWork.run((tx) => repositories.for(tx).sessions.update(first.state));
    await unitOfWork.run((tx) => repositories.for(tx).sessions.update(second.state));

    expect(await revokedAtOf(session.state.id)).toEqual(minutes(1));
  });
});
