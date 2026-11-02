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

  it('knows only the permissions of the table', () => {
    expect(PERMISSIONS).toEqual(['staff.self']);
  });

  it('denies a permission nobody granted', () => {
    expect(() => {
      // A permission from a later task, or a typo: denied, never allowed by default.
      assertAllowed('ADMIN', 'requests.decide' as never);
    }).toThrow(Forbidden);
  });
});
