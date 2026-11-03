import { beforeEach, describe, expect, it } from 'vitest';
import { CreateStaffMember } from '../../../../src/modules/staff/application/create-staff-member.ts';
import {
  ChangeStaffRole,
  DisableStaffMember,
  ListStaff,
  type StaffActor,
} from '../../../../src/modules/staff/application/manage-staff.ts';
import {
  AdminNotManaged,
  StaffMemberDisabled,
  StaffSelfChangeNotAllowed,
} from '../../../../src/modules/staff/domain/errors.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import {
  FakeHasher,
  FakeSecretBox,
  FakeTotp,
  FixedClock,
  InMemoryStaffDatabase,
  SequentialIds,
  SequentialTokens,
} from './fakes.ts';

// The admin manages the staff (v1.3.0 plan, task 7): creates an operator or
// an analyst, whose credentials show once; switches a member between the two
// roles; disables one, ending its sessions. Never itself, never an admin
// (G1, STF-14), and every change audited with the admin as its author.
const NOW = new Date('2026-11-03T12:00:00.000Z');
const admin: StaffActor = { memberId: 'admin-1', requestId: 'req-1' };

let db: InMemoryStaffDatabase;
let clock: FixedClock;
let create: CreateStaffMember;
let deps: ConstructorParameters<typeof ChangeStaffRole>[0];

beforeEach(() => {
  db = new InMemoryStaffDatabase();
  clock = new FixedClock(NOW);
  deps = { unitOfWork: db, repositories: db, clock, ids: new SequentialIds() };
  create = new CreateStaffMember({
    ...deps,
    hasher: new FakeHasher(),
    totp: new FakeTotp(),
    secrets: new FakeSecretBox(),
    tokens: new SequentialTokens(),
  });
  db.add(
    {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      lastTotpStep: null,
      isDemo: false,
      createdAt: new Date('2026-11-01T12:00:00.000Z'),
      updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    },
    'admin password',
    'ADMINSECRET',
  );
});

const added = (role: 'OPERATOR' | 'ANALYST' = 'OPERATOR') =>
  create.execute({
    email: `${role.toLowerCase()}-${String(db.members.size)}@example.com`,
    name: 'Lia Equipe',
    role,
    isDemo: false,
    author: admin,
  });

describe('CreateStaffMember by the admin', () => {
  it('creates an operator, shows its credentials once, and audits the admin as its author', async () => {
    const created = await added();

    expect(created.password).not.toBe('');
    expect(created.totpSecret).not.toBe('');
    expect(db.audit.at(-1)).toMatchObject({
      action: 'STAFF_MEMBER_CREATED',
      actorType: 'STAFF',
      actorId: 'admin-1',
      requestId: 'req-1',
      subjectId: created.id,
      metadata: { role: 'OPERATOR', isDemo: false },
    });
  });

  it('never creates an admin (G1, STF-14)', async () => {
    await expect(
      create.execute({
        email: 'other.admin@example.com',
        name: 'Outro Admin',
        role: 'ADMIN',
        isDemo: false,
        author: admin,
      }),
    ).rejects.toThrow(AdminNotManaged);
    expect(db.members.size).toBe(1);
  });
});

describe('ChangeStaffRole', () => {
  it('switches an operator to analyst, auditing both roles', async () => {
    const { id } = await added();

    const view = await new ChangeStaffRole(deps).execute(admin, { memberId: id, role: 'ANALYST' });

    expect(view).toMatchObject({ id, role: 'ANALYST', status: 'ACTIVE' });
    expect(db.audit.at(-1)).toMatchObject({
      action: 'STAFF_ROLE_CHANGED',
      actorId: 'admin-1',
      subjectId: id,
      metadata: { from: 'OPERATOR', to: 'ANALYST' },
    });
  });

  it('audits nothing when the role is already the one asked', async () => {
    const { id } = await added('ANALYST');
    const events = db.audit.length;

    await new ChangeStaffRole(deps).execute(admin, { memberId: id, role: 'ANALYST' });

    expect(db.audit).toHaveLength(events);
  });

  it('refuses the admin changing itself, and answers NotFound for an unknown member', async () => {
    await expect(
      new ChangeStaffRole(deps).execute(admin, { memberId: 'admin-1', role: 'ANALYST' }),
    ).rejects.toThrow(StaffSelfChangeNotAllowed);
    await expect(
      new ChangeStaffRole(deps).execute(admin, { memberId: 'nobody', role: 'ANALYST' }),
    ).rejects.toThrow(NotFound);
  });
});

describe('DisableStaffMember', () => {
  it('disables a member and ends every session it has (STF-06)', async () => {
    const { id } = await added();
    for (const sessionId of ['session-1', 'session-2']) {
      db.sessions.set(sessionId, {
        state: {
          id: sessionId,
          memberId: id,
          createdAt: NOW,
          lastSeenAt: NOW,
          expiresAt: new Date(NOW.getTime() + 8 * 3_600_000),
          revokedAt: null,
        },
        tokenHash: sessionId,
      });
    }

    const view = await new DisableStaffMember(deps).execute(admin, { memberId: id });

    expect(view.status).toBe('DISABLED');
    expect([...db.sessions.values()].map((session) => session.state.revokedAt)).toEqual([NOW, NOW]);
    expect(db.audit.at(-1)).toMatchObject({
      action: 'STAFF_MEMBER_DISABLED',
      actorId: 'admin-1',
      subjectId: id,
      metadata: { sessionsRevoked: 2 },
    });
  });

  it('refuses a member already disabled, the admin itself, and another admin', async () => {
    const { id } = await added();
    await new DisableStaffMember(deps).execute(admin, { memberId: id });

    await expect(new DisableStaffMember(deps).execute(admin, { memberId: id })).rejects.toThrow(
      StaffMemberDisabled,
    );
    await expect(
      new DisableStaffMember(deps).execute(admin, { memberId: 'admin-1' }),
    ).rejects.toThrow(StaffSelfChangeNotAllowed);
    await expect(
      new DisableStaffMember(deps).execute(
        { memberId: 'operator-x', requestId: null },
        { memberId: 'admin-1' },
      ),
    ).rejects.toThrow(AdminNotManaged);
  });
});

describe('ListStaff', () => {
  it('lists the staff newest first, a page at a time, without credentials', async () => {
    clock.current = new Date('2026-11-03T12:01:00.000Z');
    const older = await added();
    clock.current = new Date('2026-11-03T12:02:00.000Z');
    const newer = await added('ANALYST');

    const page = await new ListStaff(deps).execute({ after: null });

    expect(page.items.map((member) => member.id)).toEqual([newer.id, older.id, 'admin-1']);
    expect(page.items[0]).toEqual({
      id: newer.id,
      name: 'Lia Equipe',
      email: newer.email,
      role: 'ANALYST',
      status: 'ACTIVE',
      isDemo: false,
      createdAt: '2026-11-03T12:02:00.000Z',
    });
    expect(page.next).toBeNull();
  });
});
