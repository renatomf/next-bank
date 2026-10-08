import { describe, expect, it } from 'vitest';
import { endToEndId } from '../../../../src/modules/payments/domain/end-to-end-id.ts';

// The id shown on the receipt (domain-model.md 1; week 5 plan, D10): "E", a
// fictitious ISPB, the UTC minute of completion and 11 random characters.
const COMPLETED_AT = new Date('2026-10-07T23:05:42.000Z');

describe('endToEndId', () => {
  it('follows the Bacen layout with the completion minute in UTC', () => {
    expect(endToEndId(COMPLETED_AT, 'a1B2c3D4e5F')).toBe('E00000000202610072305a1B2c3D4e5F');
  });

  it('is 32 characters long, as the database requires', () => {
    expect(endToEndId(COMPLETED_AT, 'a1B2c3D4e5F')).toMatch(/^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$/);
  });

  it.each(['short', 'a1B2c3D4e5F6', 'a1B2c3D4e5-'])('refuses the random part %s', (random) => {
    expect(() => endToEndId(COMPLETED_AT, random)).toThrow(/11 letters or digits/);
  });
});
