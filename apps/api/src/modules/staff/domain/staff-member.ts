import {
  AdminNotManaged,
  InvalidStaffMember,
  StaffMemberDisabled,
  StaffSelfChangeNotAllowed,
} from './errors.ts';
import { STAFF_ROLES, type StaffRole } from './permissions.ts';

export type StaffStatus = 'ACTIVE' | 'DISABLED';

export interface StaffMemberState {
  id: string;
  /** Trimmed and lowercase, so one person is one member however it was typed. */
  email: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  /** The TOTP step of the last code accepted: a code works once (RFC 6238, 5.2). */
  lastTotpStep: number | null;
  /** A member of the public demo, who sees only demo customers (B5). */
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The roles the admin gives and changes; an admin only comes from the script (G1, STF-14). */
export const MANAGED_ROLES = ['OPERATOR', 'ANALYST'] as const;

export function assertManagedRole(role: StaffRole): void {
  if (!(MANAGED_ROLES as readonly StaffRole[]).includes(role)) throw new AdminNotManaged();
}

/** A member of the staff (v1.3.0 plan, task 1). */
export class StaffMember {
  #state: StaffMemberState;

  private constructor(state: StaffMemberState) {
    this.#state = { ...state };
  }

  static create(input: {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
    isDemo: boolean;
    now: Date;
  }): StaffMember {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!EMAIL.test(email)) throw new InvalidStaffMember('e-mail');
    if (name.length < 2 || name.length > 80) throw new InvalidStaffMember('name');
    if (!STAFF_ROLES.includes(input.role)) throw new InvalidStaffMember('role');
    return new StaffMember({
      id: input.id,
      email,
      name,
      role: input.role,
      status: 'ACTIVE',
      lastTotpStep: null,
      isDemo: input.isDemo,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(state: StaffMemberState): StaffMember {
    return new StaffMember(state);
  }

  get state(): StaffMemberState {
    return { ...this.#state };
  }

  get isActive(): boolean {
    return this.#state.status === 'ACTIVE';
  }

  /**
   * Takes the step of a code just verified, or answers false when a code of
   * that step, or of a later one, was already used.
   */
  acceptTotpStep(step: number, now: Date): boolean {
    const last = this.#state.lastTotpStep;
    if (last !== null && step <= last) return false;
    this.#state.lastTotpStep = step;
    this.#state.updatedAt = now;
    return true;
  }

  /**
   * Switches between operator and analyst, by someone else (v1.3.0 plan,
   * task 7); false when the member already has the role. The role counts on
   * the member's next request, read from the database (STF-02).
   */
  changeRole(role: StaffRole, by: string, now: Date): boolean {
    this.#assertManagedBy(by);
    assertManagedRole(role);
    if (this.#state.role === role) return false;
    this.#state.role = role;
    this.#state.updatedAt = now;
    return true;
  }

  /** For good (G4): its sessions end with it (STF-06). */
  disable(by: string, now: Date): void {
    this.#assertManagedBy(by);
    this.#state.status = 'DISABLED';
    this.#state.updatedAt = now;
  }

  #assertManagedBy(by: string): void {
    if (by === this.#state.id) throw new StaffSelfChangeNotAllowed();
    assertManagedRole(this.#state.role);
    if (!this.isActive) throw new StaffMemberDisabled();
  }
}
