import { describe, expect, it } from 'vitest';
import { formatMoney } from '../lib/format';

// Money as the staff reads it (ADR 0006): from integer cents, never a float.
describe('formatMoney', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [123456, 'R$ 1.234,56'],
    [100000000, 'R$ 1.000.000,00'],
    [-35000, '-R$ 350,00'],
  ])('shows %i cents as %s', (amount, text) => {
    expect(formatMoney({ amount, currency: 'BRL' })).toBe(text);
  });
});
