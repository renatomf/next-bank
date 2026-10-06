import { describe, expect, it } from 'vitest';
import { PinLocked } from '../../../../src/modules/identity/domain/errors.ts';
import { TransactionPin } from '../../../../src/modules/identity/domain/transaction-pin.ts';

// Brute force protection (ADR 0004, domain-model.md 3.1): 5 wrong PINs in a row
// lock verification for 30 minutes; a correct PIN resets the count.
const START = new Date('2026-10-06T12:00:00.000Z');
const MINUTE = 60_000;

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

function newPin(): TransactionPin {
  return TransactionPin.create({ userId: 'user-1', pinHash: '$argon2id$fake', now: START });
}

function fail(pin: TransactionPin, times: number, now = START) {
  let result = pin.recordVerification(false, now);
  for (let i = 1; i < times; i++) result = pin.recordVerification(false, now);
  return result;
}

describe('TransactionPin', () => {
  it('starts with no failed attempts and unlocked', () => {
    expect(newPin().state).toEqual({
      userId: 'user-1',
      pinHash: '$argon2id$fake',
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: START,
    });
  });

  it('tells how many attempts remain after a wrong PIN', () => {
    const pin = newPin();

    expect(pin.recordVerification(false, START)).toEqual({
      outcome: 'INCORRECT',
      remainingAttempts: 4,
    });
    expect(pin.recordVerification(false, START)).toEqual({
      outcome: 'INCORRECT',
      remainingAttempts: 3,
    });
  });

  it('locks for 30 minutes on the 5th wrong PIN in a row', () => {
    const pin = newPin();

    const result = fail(pin, 5, at(MINUTE));

    expect(result).toEqual({ outcome: 'LOCKED', lockedUntil: at(31 * MINUTE) });
    expect(pin.state).toMatchObject({ failedAttempts: 5, lockedUntil: at(31 * MINUTE) });
  });

  it('refuses to verify while locked, before any hashing (PinLocked)', () => {
    const pin = newPin();
    fail(pin, 5);

    expect(() => {
      pin.assertCanVerify(at(30 * MINUTE - 1));
    }).toThrow(PinLocked);
  });

  it('reports until when it is locked', () => {
    const pin = newPin();
    fail(pin, 5);

    expect(() => {
      pin.assertCanVerify(at(MINUTE));
    }).toThrow(expect.objectContaining({ code: 'PinLocked', lockedUntil: at(30 * MINUTE) }));
  });

  it('allows a fresh set of 5 attempts once the lock expires', () => {
    const pin = newPin();
    fail(pin, 5);

    pin.assertCanVerify(at(30 * MINUTE));

    expect(pin.state).toMatchObject({ failedAttempts: 0, lockedUntil: null });
    expect(pin.recordVerification(false, at(30 * MINUTE))).toEqual({
      outcome: 'INCORRECT',
      remainingAttempts: 4,
    });
  });

  it('resets the count after a correct PIN', () => {
    const pin = newPin();
    fail(pin, 4);

    expect(pin.recordVerification(true, at(MINUTE))).toEqual({ outcome: 'VERIFIED' });
    expect(pin.state).toMatchObject({ failedAttempts: 0, updatedAt: at(MINUTE) });
  });

  it('refuses to record an attempt while locked, as a programming error', () => {
    const pin = newPin();
    fail(pin, 5);

    expect(() => pin.recordVerification(true, at(MINUTE))).toThrow(/locked/);
  });

  it('can be restored from storage with the same state', () => {
    const original = newPin();
    fail(original, 2);

    const restored = TransactionPin.restore(original.state);

    expect(restored.state).toEqual(original.state);
  });
});
