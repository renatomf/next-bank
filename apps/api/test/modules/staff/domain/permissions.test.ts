import { describe, expect, it } from 'vitest';
import { Forbidden } from '../../../../src/modules/staff/domain/errors.ts';
import {
  assertAllowed,
  PERMISSIONS,
  STAFF_ROLES,
} from '../../../../src/modules/staff/domain/permissions.ts';

// What each role of the staff may do (v1.3.0 plan, task 1; STF-02): only what
// the table grants; anything else is denied. Each task adds its permissions.
describe('permissions', () => {
  it('lets every role see itself and sign out', () => {
    for (const role of STAFF_ROLES) {
      expect(() => {
        assertAllowed(role, 'staff.self');
      }).not.toThrow();
    }
  });

  it('lets the operator and the analyst read customers, never the admin (task 3, C1)', () => {
    expect(() => {
      assertAllowed('OPERATOR', 'customers.read');
    }).not.toThrow();
    expect(() => {
      assertAllowed('ANALYST', 'customers.read');
    }).not.toThrow();
    // The admin manages the staff and sees no customer: segregation of duties.
    expect(() => {
      assertAllowed('ADMIN', 'customers.read');
    }).toThrow(Forbidden);
  });

  it('knows only the permissions of the table', () => {
    expect(PERMISSIONS).toEqual([
      'staff.self',
      'customers.read',
      'accounts.block',
      'requests.read',
      'requests.create',
      'requests.decide',
      'exceptions.read',
      'exceptions.explain',
      'staff.manage',
      'audit.read',
    ]);
  });

  it('lets the analyst and the admin read the audit trail, never the operator (task 8, H1)', () => {
    for (const role of ['ANALYST', 'ADMIN'] as const) {
      expect(() => {
        assertAllowed(role, 'audit.read');
      }).not.toThrow();
    }
    expect(() => {
      assertAllowed('OPERATOR', 'audit.read');
    }).toThrow(Forbidden);
  });

  it('lets the operator and the analyst read exceptions, and only the analyst explain one (task 6, X2)', () => {
    for (const role of ['OPERATOR', 'ANALYST'] as const) {
      expect(() => {
        assertAllowed(role, 'exceptions.read');
      }).not.toThrow();
    }
    expect(() => {
      assertAllowed('ANALYST', 'exceptions.explain');
    }).not.toThrow();
    for (const role of ['OPERATOR', 'ADMIN'] as const) {
      expect(() => {
        assertAllowed(role, 'exceptions.explain');
      }).toThrow(Forbidden);
    }
    expect(() => {
      assertAllowed('ADMIN', 'exceptions.read');
    }).toThrow(Forbidden);
  });

  it('denies a permission nobody granted', () => {
    expect(() => {
      // A permission from a later task, or a typo: denied, never allowed by default.
      assertAllowed('ADMIN', 'payments.reverse' as never);
    }).toThrow(Forbidden);
  });
});
