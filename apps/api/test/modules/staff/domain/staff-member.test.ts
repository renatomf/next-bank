import { describe, expect, it } from 'vitest';
import { InvalidStaffMember } from '../../../../src/modules/staff/domain/errors.ts';
import { StaffMember } from '../../../../src/modules/staff/domain/staff-member.ts';

// A member of the staff (v1.3.0 plan, task 1): a role, a status, and the
// step of the last TOTP code it signed in with, so a code works once
// (RFC 6238, section 5.2).
const NOW = new Date('2026-11-02T12:00:00.000Z');
const LATER = new Date('2026-11-02T12:05:00.000Z');

const create = (overrides: Partial<Parameters<typeof StaffMember.create>[0]> = {}) =>
  StaffMember.create({
    id: 'member-1',
    email: ' Lia.Operadora@Example.com ',
    name: 'Lia Operadora',
    role: 'OPERATOR',
    isDemo: false,
    now: NOW,
    ...overrides,
  });

describe('StaffMember', () => {
  it('starts active, with its e-mail normalized and no code used yet', () => {
    expect(create().state).toEqual({
      id: 'member-1',
      email: 'lia.operadora@example.com',
      name: 'Lia Operadora',
      role: 'OPERATOR',
      status: 'ACTIVE',
      lastTotpStep: null,
      isDemo: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it.each([
    ['an e-mail without @', { email: 'lia.example.com' }],
    ['a name of one letter', { name: 'L' }],
    ['a name over 80 letters', { name: 'L'.repeat(81) }],
    ['an unknown role', { role: 'ROOT' as never }],
  ])('refuses %s', (_case, overrides) => {
    expect(() => create(overrides)).toThrow(InvalidStaffMember);
  });

  it('takes a code once, and never one from before it', () => {
    const member = create();

    expect(member.acceptTotpStep(1_000, NOW)).toBe(true);
    expect(member.acceptTotpStep(1_000, LATER)).toBe(false);
    expect(member.acceptTotpStep(999, LATER)).toBe(false);
    expect(member.acceptTotpStep(1_001, LATER)).toBe(true);
    expect(member.state).toMatchObject({ lastTotpStep: 1_001, updatedAt: LATER });
  });

  it('is active only while its status says so', () => {
    expect(create().isActive).toBe(true);
    expect(StaffMember.restore({ ...create().state, status: 'DISABLED' }).isActive).toBe(false);
  });
});
