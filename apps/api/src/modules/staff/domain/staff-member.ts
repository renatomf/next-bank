import { InvalidStaffMember } from './errors.ts';
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
}
