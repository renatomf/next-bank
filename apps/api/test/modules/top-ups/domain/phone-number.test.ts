import { describe, expect, it } from 'vitest';
import { InvalidPhoneNumber } from '../../../../src/modules/top-ups/domain/errors.ts';
import { PhoneNumber } from '../../../../src/modules/top-ups/domain/phone-number.ts';

// TOP-01, DEMO-01 (v1.1.0 plan, task 5; decision R1): only the made-up range
// (DD) 90000-XXXX is taken, so no one recharges a real person's line, not
// even by mistake.
describe('PhoneNumber', () => {
  it.each([
    ['digits only', '11900000001'],
    ['as people type it', '(11) 90000-0001'],
    ['with spaces', '11 90000 0001'],
  ])('takes a made-up number written %s', (_case, raw) => {
    expect(PhoneNumber.parse(raw).digits).toBe('11900000001');
  });

  it('shows only the area code and the last four digits', () => {
    expect(PhoneNumber.parse('21900001234').masked).toBe('(21) *****-1234');
  });

  it.each([
    ['a real-looking mobile number', '11987654321'],
    ['the made-up range with a missing digit', '1190000001'],
    ['an area code that does not exist', '20900000001'],
    ['letters', '11 9000O-0001'],
    ['a landline', '1130000001'],
    ['nothing', ''],
  ])('refuses %s (InvalidPhoneNumber)', (_case, raw) => {
    expect(() => PhoneNumber.parse(raw)).toThrow(InvalidPhoneNumber);
  });
});
