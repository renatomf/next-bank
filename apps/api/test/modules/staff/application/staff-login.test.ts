import { beforeEach, describe, expect, it } from 'vitest';
import { StaffLogin } from '../../../../src/modules/staff/application/staff-login.ts';
import { InvalidCredentials } from '../../../../src/modules/staff/domain/errors.ts';
import { StaffMember } from '../../../../src/modules/staff/domain/staff-member.ts';
import { TooManyAttempts } from '../../../../src/shared/domain/too-many-attempts.ts';
import {
  FakeHasher,
  FakeLoginAttemptsStore,
  FakeSecretBox,
  FakeTotp,
  FixedClock,
  InMemoryStaffDatabase,
  SequentialIds,
  SequentialTokens,
} from './fakes.ts';

// The staff's login (v1.3.0 plan, task 1; STF-01, S2): e-mail, password and
// the authenticator's code in one step. Any wrong factor gets the same
// refusal, every attempt costs one Argon2id verification (AUTH-02), and a
// code works once (RFC 6238, section 5.2).
const NOW = new Date('2026-11-02T12:00:00.000Z');
const PASSWORD = 'eleven char';
const SECRET = 'MEMBERSECRET';

let db: InMemoryStaffDatabase;
let hasher: FakeHasher;
let totp: FakeTotp;
let attempts: FakeLoginAttemptsStore;
let clock: FixedClock;
let login: StaffLogin;

beforeEach(() => {
  db = new InMemoryStaffDatabase();
  hasher = new FakeHasher();
  totp = new FakeTotp();
  totp.codes.set('123456', 59_000);
  attempts = new FakeLoginAttemptsStore();
  clock = new FixedClock(NOW);
  login = new StaffLogin({
    unitOfWork: db,
    repositories: db,
    clock,
    ids: new SequentialIds(),
    hasher,
    totp,
    secrets: new FakeSecretBox(),
    tokens: new SequentialTokens(),
    attempts,
  });
  db.add(
    StaffMember.create({
      id: 'member-1',
      email: 'lia@example.com',
      name: 'Lia Operadora',
      role: 'OPERATOR',
      isDemo: false,
      now: NOW,
    }).state,
    PASSWORD,
    SECRET,
  );
});

const attempt = (overrides: Partial<{ email: string; password: string; mfaCode: string }> = {}) =>
  login.execute({
    email: 'Lia@Example.com',
    password: PASSWORD,
    mfaCode: '123456',
    requestId: 'req-1',
    ...overrides,
  });

describe('StaffLogin', () => {
  it('opens a session with the right password and code', async () => {
    const result = await attempt();

    expect(result).toEqual({
      token: 'token-1',
      expiresAt: new Date(NOW.getTime() + 8 * 60 * 60_000),
      member: { name: 'Lia Operadora', role: 'OPERATOR' },
    });
    expect(db.sessions.size).toBe(1);
    expect(db.members.get('member-1')?.state.lastTotpStep).toBe(59_000);
    expect(db.actions()).toEqual(['STAFF_LOGIN_SUCCEEDED']);
    expect(db.audit[0]).toMatchObject({ actorType: 'STAFF', actorId: 'member-1' });
  });

  it.each([
    ['a wrong password', { password: 'wrong password!' }],
    ['a wrong code', { mfaCode: '000000' }],
    ['no code', { mfaCode: '' }],
    ['an unknown e-mail', { email: 'nobody@example.com' }],
  ])('refuses %s the same way, opening nothing', async (_case, overrides) => {
    await expect(attempt(overrides)).rejects.toThrow(InvalidCredentials);

    expect(db.sessions.size).toBe(0);
  });

  it('verifies one password on every path, an unknown e-mail included (AUTH-02)', async () => {
    await attempt({ email: 'nobody@example.com' }).catch(() => undefined);
    await attempt({ mfaCode: '000000' }).catch(() => undefined);

    expect(hasher.verified).toHaveLength(2);
  });

  it('records why a known member failed, only in the audit', async () => {
    await attempt({ mfaCode: '000000' }).catch(() => undefined);
    await attempt({ password: 'wrong password!' }).catch(() => undefined);

    expect(db.audit.map((event) => [event.action, event.metadata])).toEqual([
      ['STAFF_LOGIN_FAILED', { reason: 'INVALID_CODE' }],
      ['STAFF_LOGIN_FAILED', { reason: 'INVALID_PASSWORD' }],
    ]);
  });

  it('takes a code once: the same code again opens nothing (RFC 6238, 5.2)', async () => {
    await attempt();

    await expect(attempt()).rejects.toThrow(InvalidCredentials);
    expect(db.sessions.size).toBe(1);
    expect(db.audit.at(-1)?.metadata).toEqual({ reason: 'CODE_REUSED' });
  });

  it('refuses a disabled member, even with every factor right', async () => {
    const member = db.members.get('member-1');
    if (member)
      db.members.set('member-1', { ...member, state: { ...member.state, status: 'DISABLED' } });

    await expect(attempt()).rejects.toThrow(InvalidCredentials);
    expect(db.audit.at(-1)?.metadata).toEqual({ reason: 'MEMBER_DISABLED' });
  });

  it('blocks the e-mail after 5 wrong attempts in a minute, before any verification', async () => {
    for (let i = 0; i < 5; i += 1) {
      await attempt({ mfaCode: '000000' }).catch(() => undefined);
    }
    const verified = hasher.verified.length;

    await expect(attempt()).rejects.toThrow(TooManyAttempts);
    expect(hasher.verified).toHaveLength(verified);
  });

  it('counts a burst of simultaneous wrong attempts before any of them finishes (F-11)', async () => {
    const burst = Array.from({ length: 10 }, () => attempt({ mfaCode: '000000' }));
    const reasons = await Promise.allSettled(burst);

    expect(
      reasons.filter((r) => r.status === 'rejected' && r.reason instanceof TooManyAttempts),
    ).toHaveLength(5);
  });

  it('clears the count after a successful login', async () => {
    await attempt({ mfaCode: '000000' }).catch(() => undefined);

    await attempt();

    expect(attempts.entries.size).toBe(0);
  });
});
