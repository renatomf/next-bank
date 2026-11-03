import { beforeEach, describe, expect, it } from 'vitest';
import { AuthenticateStaff } from '../../../../src/modules/staff/application/authenticate-staff.ts';
import { CreateStaffMember } from '../../../../src/modules/staff/application/create-staff-member.ts';
import { StaffLogin } from '../../../../src/modules/staff/application/staff-login.ts';
import { StaffLogout } from '../../../../src/modules/staff/application/staff-logout.ts';
import {
  InvalidStaffMember,
  StaffMemberExists,
  StaffSessionExpired,
  Unauthenticated,
} from '../../../../src/modules/staff/domain/errors.ts';
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

// A member from the script to a session and out (v1.3.0 plan, task 1; S7,
// STF-06): the script creates the member and shows its password and TOTP
// secret once; each request authenticates the session, which ends after 15
// minutes without use, after 8 hours or at logout.
const NOW = new Date('2026-11-02T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

let db: InMemoryStaffDatabase;
let clock: FixedClock;
let totp: FakeTotp;
let hasher: FakeHasher;
let create: CreateStaffMember;
let login: StaffLogin;
let authenticate: AuthenticateStaff;
let logout: StaffLogout;

beforeEach(() => {
  db = new InMemoryStaffDatabase();
  clock = new FixedClock(NOW);
  totp = new FakeTotp();
  hasher = new FakeHasher();
  const shared = {
    unitOfWork: db,
    repositories: db,
    clock,
    ids: new SequentialIds(),
  };
  const tokens = new SequentialTokens();
  const secrets = new FakeSecretBox();
  create = new CreateStaffMember({ ...shared, hasher, totp, secrets, tokens });
  login = new StaffLogin({
    ...shared,
    hasher,
    totp,
    secrets,
    tokens,
    attempts: new FakeLoginAttemptsStore(),
  });
  authenticate = new AuthenticateStaff({ ...shared, tokens });
  logout = new StaffLogout(shared);
});

async function signedIn(): Promise<string> {
  const created = await create.execute({
    email: 'lia@example.com',
    name: 'Lia Operadora',
    role: 'ANALYST',
    isDemo: false,
  });
  totp.codes.set('123456', 59_000);
  const { token } = await login.execute({
    email: 'lia@example.com',
    password: created.password,
    mfaCode: '123456',
    requestId: null,
  });
  return token;
}

describe('CreateStaffMember', () => {
  it('stores the member sealed and shows its password and secret once', async () => {
    const created = await create.execute({
      email: 'Lia@Example.com',
      name: 'Lia Operadora',
      role: 'ADMIN',
      isDemo: false,
    });

    const { member, ...shown } = created;
    // The member as created, for the admin's screen (task 7).
    expect(member).toMatchObject({ id: 'id-1', role: 'ADMIN', status: 'ACTIVE' });
    expect(shown).toEqual({
      id: 'id-1',
      email: 'lia@example.com',
      // Drawn by the token generator, 43 characters in production.
      password: 'token-1',
      totpSecret: 'SECRET1',
      totpUri: 'otpauth://totp/next%20bank:lia@example.com?secret=SECRET1',
    });
    const stored = db.members.get('id-1');
    expect(stored?.passwordHash).not.toContain(created.password);
    expect(Buffer.from(stored?.totpSecret.ciphertext ?? []).toString()).toBe('sealed:SECRET1');
    expect(db.actions()).toEqual(['STAFF_MEMBER_CREATED']);
  });

  // The admin of the published demo, recreated at every reset with the
  // credentials kept in the deploy's secrets (v1.3.0 plan, task 2, D4).
  it('takes given credentials instead of drawing new ones', async () => {
    const created = await create.execute({
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      isDemo: false,
      credentials: { password: 'a kept password, long enough', totpSecret: 'KEPTSECRET' },
    });

    expect(created).toMatchObject({
      password: 'a kept password, long enough',
      totpSecret: 'KEPTSECRET',
    });
    expect(Buffer.from(db.members.get(created.id)?.totpSecret.ciphertext ?? []).toString()).toBe(
      'sealed:KEPTSECRET',
    );
  });

  it('refuses an e-mail already in the staff', async () => {
    await create.execute({ email: 'lia@example.com', name: 'Lia', role: 'ADMIN', isDemo: false });

    await expect(
      create.execute({ email: 'LIA@example.com', name: 'Outra', role: 'OPERATOR', isDemo: false }),
    ).rejects.toThrow(StaffMemberExists);
  });

  it('refuses an invalid member', async () => {
    await expect(
      create.execute({ email: 'not-an-email', name: 'Lia', role: 'ADMIN', isDemo: false }),
    ).rejects.toThrow(InvalidStaffMember);
  });
});

describe('AuthenticateStaff', () => {
  it('answers the member, the role, the demo scope and the session of a token', async () => {
    const token = await signedIn();

    await expect(authenticate.execute(token)).resolves.toEqual({
      memberId: 'id-1',
      sessionId: 'id-3',
      name: 'Lia Operadora',
      role: 'ANALYST',
      // Read from the database on every request, never from the client (STF-11).
      isDemo: false,
    });
  });

  it.each(['token-999', 'eyJhbGciOiJFZERTQSJ9.customer.jwt', ''])(
    'refuses a token it never issued: %s',
    async (token) => {
      await signedIn();

      await expect(authenticate.execute(token)).rejects.toThrow(Unauthenticated);
    },
  );

  it('keeps the session alive while it is used, and ends it after 15 idle minutes', async () => {
    const token = await signedIn();
    clock.current = minutes(14);
    await authenticate.execute(token);

    clock.current = minutes(28);
    await expect(authenticate.execute(token)).resolves.toBeDefined();
    clock.current = minutes(43);
    await expect(authenticate.execute(token)).rejects.toThrow(StaffSessionExpired);
  });

  it('ends the session of a member disabled meanwhile', async () => {
    const token = await signedIn();
    const member = db.members.get('id-1');
    if (member)
      db.members.set('id-1', { ...member, state: { ...member.state, status: 'DISABLED' } });

    await expect(authenticate.execute(token)).rejects.toThrow(StaffSessionExpired);
  });
});

describe('StaffLogout', () => {
  it('revokes the session at once, and records it', async () => {
    const token = await signedIn();
    const caller = await authenticate.execute(token);

    await logout.execute({
      memberId: caller.memberId,
      sessionId: caller.sessionId,
      requestId: 'r',
    });

    await expect(authenticate.execute(token)).rejects.toThrow(StaffSessionExpired);
    expect(db.actions()).toContain('STAFF_SESSION_REVOKED');
  });
});
