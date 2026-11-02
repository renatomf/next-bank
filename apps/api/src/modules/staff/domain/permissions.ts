import { Forbidden } from './errors.ts';

export const STAFF_ROLES = ['OPERATOR', 'ANALYST', 'ADMIN'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Everything a staff route may ask for; each task of v1.3.0 adds its own. */
export const PERMISSIONS = [
  'staff.self',
  'customers.read',
  'accounts.block',
  'requests.read',
  'requests.create',
  'requests.decide',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role may do (v1.3.0 plan, roadmap section 10; STF-02). Only what
 * this table grants is allowed: a permission missing from a role, or one
 * that does not exist, is denied.
 */
const GRANTS: Readonly<Record<StaffRole, readonly Permission[]>> = {
  // Asks; blocks at once, a protection that moves no money (task 4, K3).
  OPERATOR: ['staff.self', 'customers.read', 'accounts.block', 'requests.read', 'requests.create'],
  // Decides what someone else asked (B6, STF-03).
  ANALYST: ['staff.self', 'customers.read', 'accounts.block', 'requests.read', 'requests.decide'],
  // Manages the staff and reads no customer: segregation of duties (task 3, C1).
  ADMIN: ['staff.self'],
};

export function assertAllowed(role: StaffRole, permission: Permission): void {
  if (!GRANTS[role].includes(permission)) throw new Forbidden();
}
