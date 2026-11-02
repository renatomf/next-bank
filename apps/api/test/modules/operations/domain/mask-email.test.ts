import { describe, expect, it } from 'vitest';
import { maskEmail } from '../../../../src/modules/operations/domain/mask-email.ts';

// The staff sees the e-mail masked (v1.3.0 plan, task 3; STF-07): enough to
// tell two customers apart over the phone, never the whole address.
describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('ana.souza@example.test')).toBe('a***@example.test');
  });

  it('hides the length of the name', () => {
    expect(maskEmail('a@example.test')).toBe('a***@example.test');
    expect(maskEmail('bruno.lima.costa@example.test')).toBe('b***@example.test');
  });
});
