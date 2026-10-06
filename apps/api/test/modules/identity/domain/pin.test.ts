import { describe, expect, it } from 'vitest';
import { InvalidPin } from '../../../../src/modules/identity/domain/errors.ts';
import { Pin } from '../../../../src/modules/identity/domain/pin.ts';

// Transaction PIN rule (domain-model.md 3.1): 4 digits, no trivial sequences.
describe('Pin', () => {
  it('accepts 4 digits without a trivial pattern', () => {
    expect(Pin.create('2580').value).toBe('2580');
    expect(Pin.create('0192').value).toBe('0192');
  });

  it.each([
    ['repeated digits', '0000'],
    ['repeated digits', '7777'],
    ['ascending sequence', '1234'],
    ['ascending sequence', '6789'],
    ['descending sequence', '4321'],
    ['descending sequence', '9876'],
  ])('rejects %s: %s (InvalidPin)', (_case, raw) => {
    expect(() => Pin.create(raw)).toThrow(InvalidPin);
  });

  it.each([
    ['3 digits', '123'],
    ['5 digits', '25801'],
    ['letters', '25a0'],
    ['spaces', ' 2580'],
    ['non-ASCII digits', '٢٥٨٠'],
  ])('rejects %s (InvalidPin)', (_case, raw) => {
    expect(() => Pin.create(raw)).toThrow(InvalidPin);
  });

  it('never prints the secret by accident', () => {
    const pin = Pin.create('2580');

    expect(String(pin)).toBe('[REDACTED]');
    expect(JSON.stringify({ pin })).toBe('{"pin":"[REDACTED]"}');
  });

  it('carries the catalog code', () => {
    expect(() => Pin.create('1111')).toThrow(expect.objectContaining({ code: 'InvalidPin' }));
  });
});
