import { describe, expect, it } from 'vitest';
import type { SecretHasher } from '../../../../src/modules/identity/application/ports.ts';
import { VerifyPin } from '../../../../src/modules/identity/application/verify-pin.ts';
import {
  PinIncorrect,
  PinLocked,
  PinNotCreated,
  PinResetRequired,
} from '../../../../src/modules/identity/domain/errors.ts';
import type { TransactionPinState } from '../../../../src/modules/identity/domain/transaction-pin.ts';
import { FixedClock, InMemoryDatabase, SequentialIds } from './fakes.ts';

// PIN verification (domain-model.md 3.1; ADR 0004; PIX-05; F-16): the same
// counter for the Unlock screen and the Pix. A wrong attempt is recorded even
// though the answer is an error (ADR 0010, rule 3).
const NOW = new Date('2026-10-07T12:00:00.000Z');
const RIGHT = '2580';
const WRONG = '7413';

/** Matches only the PIN it was created for, and records every check. */
class OnePinHasher implements SecretHasher {
  verified: string[] = [];
  hash(secret: string): Promise<string> {
    return Promise.resolve(`pin:${secret}`);
  }
  verify(hash: string, secret: string): Promise<boolean> {
    this.verified.push(secret);
    return Promise.resolve(hash === `pin:${secret}`);
  }
}

function setup(pin: Partial<TransactionPinState> | null = {}) {
  const db = new InMemoryDatabase();
  if (pin !== null) {
    db.transactionPins = [
      {
        userId: 'user-1',
        pinHash: `pin:${RIGHT}`,
        failedAttempts: 0,
        lockedUntil: null,
        recentLocks: [],
        resetRequired: false,
        updatedAt: NOW,
        ...pin,
      },
    ];
  }
  const clock = new FixedClock(NOW);
  const pinHasher = new OnePinHasher();
  const verifyPin = new VerifyPin({
    unitOfWork: db,
    repositories: db,
    clock,
    ids: new SequentialIds(),
    pinHasher,
  });
  return { db, clock, pinHasher, verifyPin };
}

const attempt = (pin: string) => ({ userId: 'user-1', pin, requestId: 'req-1' });

describe('VerifyPin.execute (the Unlock route)', () => {
  it('accepts the right PIN and clears earlier failures', async () => {
    const { db, verifyPin } = setup({ failedAttempts: 3 });

    await verifyPin.execute(attempt(RIGHT));

    expect(db.transactionPins[0]?.failedAttempts).toBe(0);
  });

  it('refuses a wrong PIN, says how many attempts remain and keeps the count', async () => {
    const { db, verifyPin } = setup();

    const failure = verifyPin.execute(attempt(WRONG));

    await expect(failure).rejects.toThrow(PinIncorrect);
    await expect(failure).rejects.toMatchObject({ remainingAttempts: 4 });
    expect(db.transactionPins[0]?.failedAttempts).toBe(1);
  });

  it('locks for 30 minutes at the 5th wrong PIN and records PIN_LOCKED (PIX-05)', async () => {
    const { db, verifyPin } = setup({ failedAttempts: 4 });

    await expect(verifyPin.execute(attempt(WRONG))).rejects.toThrow(PinLocked);

    expect(db.transactionPins[0]?.lockedUntil).toEqual(new Date('2026-10-07T12:30:00.000Z'));
    expect(db.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIN_LOCKED',
        actorId: 'user-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        requestId: 'req-1',
        metadata: {},
      }),
    ]);
    expect(JSON.stringify(db.auditEvents)).not.toContain(WRONG);
  });

  it('refuses even the right PIN while locked, without checking it', async () => {
    const { pinHasher, verifyPin } = setup({
      failedAttempts: 5,
      lockedUntil: new Date('2026-10-07T12:20:00.000Z'),
      recentLocks: [new Date('2026-10-07T11:50:00.000Z')],
    });

    await expect(verifyPin.execute(attempt(RIGHT))).rejects.toThrow(PinLocked);
    expect(pinHasher.verified).toEqual([]);
  });

  it('gives a fresh set of attempts once the lock has passed', async () => {
    const { db, verifyPin } = setup({
      failedAttempts: 5,
      lockedUntil: new Date('2026-10-07T11:59:59.999Z'),
      recentLocks: [new Date('2026-10-07T11:29:59.999Z')],
    });

    await expect(verifyPin.execute(attempt(WRONG))).rejects.toMatchObject({
      remainingAttempts: 4,
    });
    expect(db.transactionPins[0]).toMatchObject({ failedAttempts: 1, lockedUntil: null });
  });

  it('requires a reset with the password at the 3rd lock in 24 hours (D7)', async () => {
    const { db, verifyPin } = setup({
      failedAttempts: 4,
      recentLocks: [new Date('2026-10-07T02:00:00.000Z'), new Date('2026-10-07T08:00:00.000Z')],
    });

    await expect(verifyPin.execute(attempt(WRONG))).rejects.toThrow(PinResetRequired);
    expect(db.transactionPins[0]?.resetRequired).toBe(true);
    expect(db.auditEvents.map((event) => event.action)).toEqual(['PIN_LOCKED']);
  });

  it('refuses while a reset is required', async () => {
    const { verifyPin } = setup({ resetRequired: true });

    await expect(verifyPin.execute(attempt(RIGHT))).rejects.toThrow(PinResetRequired);
  });

  it('refuses a customer without a PIN (PinNotCreated, D8)', async () => {
    const { verifyPin } = setup(null);

    await expect(verifyPin.execute(attempt(RIGHT))).rejects.toThrow(PinNotCreated);
  });
});

// Payments verifies the PIN inside the Pix transaction (database.md, section 7).
describe('VerifyPin.verify (inside the caller transaction)', () => {
  it('answers the outcome as a value, so the caller can commit what changed', async () => {
    const { db, verifyPin } = setup();

    const outcome = await db.run((tx) => verifyPin.verify(tx, attempt(WRONG)));

    expect(outcome).toEqual({ outcome: 'INCORRECT', remainingAttempts: 4 });
    expect(db.transactionPins[0]?.failedAttempts).toBe(1);
  });

  // The Pix cancels the transfer when the PIN is locked (domain-model.md 4).
  it('answers a lock already in force as a value too, recording nothing new', async () => {
    const lockedUntil = new Date('2026-10-07T12:20:00.000Z');
    const { db, verifyPin } = setup({ failedAttempts: 5, lockedUntil });

    const outcome = await db.run((tx) => verifyPin.verify(tx, attempt(RIGHT)));

    expect(outcome).toEqual({ outcome: 'LOCKED', lockedUntil });
    expect(db.auditEvents).toEqual([]);
  });

  it('answers VERIFIED for the right PIN', async () => {
    const { db, verifyPin } = setup();

    await expect(db.run((tx) => verifyPin.verify(tx, attempt(RIGHT)))).resolves.toEqual({
      outcome: 'VERIFIED',
    });
  });
});
