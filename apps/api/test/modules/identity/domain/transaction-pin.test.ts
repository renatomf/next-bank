import { describe, expect, it } from 'vitest';
import { PinLocked, PinResetRequired } from '../../../../src/modules/identity/domain/errors.ts';
import { TransactionPin } from '../../../../src/modules/identity/domain/transaction-pin.ts';

// Brute force protection (ADR 0004, domain-model.md 3.1): 5 wrong PINs in a row
// lock verification for 30 minutes; a correct PIN resets the count.
const START = new Date('2026-10-06T12:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

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
      recentLocks: [],
      resetRequired: false,
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

  it('lets an unlocked PIN be verified without changing it', () => {
    const pin = newPin();
    fail(pin, 2);

    pin.assertCanVerify(at(MINUTE));

    expect(pin.state).toMatchObject({ failedAttempts: 2, updatedAt: START });
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

  describe('repeated locks (D7, PIX-05)', () => {
    /** Five wrong PINs at the given time, after any previous lock has expired. */
    function lockAt(pin: TransactionPin, now: Date) {
      pin.assertCanVerify(now);
      return fail(pin, 5, now);
    }

    it('requires a reset with the password on the 3rd lock within 24 h', () => {
      const pin = newPin();
      lockAt(pin, START);
      lockAt(pin, at(HOUR));

      const result = lockAt(pin, at(2 * HOUR));

      expect(result).toEqual({ outcome: 'RESET_REQUIRED' });
      expect(pin.state).toMatchObject({ resetRequired: true, lockedUntil: null });
    });

    it('stays blocked after any amount of time until reset (PinResetRequired)', () => {
      const pin = newPin();
      for (const hour of [0, 1, 2]) lockAt(pin, at(hour * HOUR));

      expect(() => {
        pin.assertCanVerify(at(30 * 24 * HOUR));
      }).toThrow(PinResetRequired);
    });

    it('does not count locks older than 24 h', () => {
      const pin = newPin();
      lockAt(pin, START);
      lockAt(pin, at(12 * HOUR));

      // The first lock is now 25 h old: only two locks fall within 24 h.
      expect(lockAt(pin, at(25 * HOUR))).toMatchObject({ outcome: 'LOCKED' });
    });

    it('uses a sliding 24 h window, not a fixed one', () => {
      const pin = newPin();
      lockAt(pin, START);
      lockAt(pin, at(20 * HOUR));
      expect(lockAt(pin, at(30 * HOUR))).toMatchObject({ outcome: 'LOCKED' });

      // 20 h, 30 h and 40 h are three locks within 24 h.
      expect(lockAt(pin, at(40 * HOUR))).toEqual({ outcome: 'RESET_REQUIRED' });
    });

    it('keeps only the two most recent locks', () => {
      const pin = newPin();
      for (const hour of [0, 25, 50]) lockAt(pin, at(hour * HOUR));

      expect(pin.state.recentLocks).toEqual([at(25 * HOUR), at(50 * HOUR)]);
    });

    it('refuses to record an attempt once a reset is required, as a programming error', () => {
      const pin = newPin();
      for (const hour of [0, 1, 2]) lockAt(pin, at(hour * HOUR));

      expect(() => pin.recordVerification(true, at(3 * HOUR))).toThrow(/reset/);
    });

    it('carries the catalog code', () => {
      const pin = newPin();
      for (const hour of [0, 1, 2]) lockAt(pin, at(hour * HOUR));

      expect(() => {
        pin.assertCanVerify(at(3 * HOUR));
      }).toThrow(expect.objectContaining({ code: 'PinResetRequired' }));
    });
  });

  it('can be restored from storage with the same state', () => {
    const original = newPin();
    fail(original, 2);

    const restored = TransactionPin.restore(original.state);

    expect(restored.state).toEqual(original.state);
  });
});

// domain-model.md 3.1: Change needs the password (checked outside the domain)
// and is how a locked PIN, even one that needs a reset, is recovered (week 7
// plan, D5).
describe('TransactionPin.change', () => {
  it('takes the new PIN hash and records when', () => {
    const pin = newPin();

    pin.change('$argon2id$new', at(HOUR));

    expect(pin.state.pinHash).toBe('$argon2id$new');
    expect(pin.state.updatedAt).toEqual(at(HOUR));
  });

  it('clears the wrong attempts', () => {
    const pin = newPin();
    fail(pin, 3);

    pin.change('$argon2id$new', at(MINUTE));

    expect(pin.state.failedAttempts).toBe(0);
  });

  it('lifts a 30 minute lock at once', () => {
    const pin = newPin();
    fail(pin, 5);

    pin.change('$argon2id$new', at(MINUTE));

    expect(pin.state.lockedUntil).toBeNull();
    expect(() => {
      pin.assertCanVerify(at(MINUTE));
    }).not.toThrow();
  });

  it('recovers a PIN that needed a reset, with a clean history of locks', () => {
    const pin = newPin();
    for (let lock = 0; lock < 3; lock++) {
      const now = at(lock * HOUR);
      pin.assertCanVerify(now);
      fail(pin, 5, now);
    }
    expect(() => {
      pin.assertCanVerify(at(4 * HOUR));
    }).toThrow(PinResetRequired);

    pin.change('$argon2id$new', at(4 * HOUR));

    expect(pin.state.resetRequired).toBe(false);
    expect(pin.state.recentLocks).toEqual([]);
    expect(() => {
      pin.assertCanVerify(at(4 * HOUR));
    }).not.toThrow();
  });

  it('a recovered PIN locks again after 5 wrong attempts', () => {
    const pin = newPin();
    fail(pin, 5);
    pin.change('$argon2id$new', at(MINUTE));

    const result = fail(pin, 5, at(MINUTE));

    expect(result.outcome).toBe('LOCKED');
    expect(() => {
      pin.assertCanVerify(at(2 * MINUTE));
    }).toThrow(PinLocked);
  });
});
