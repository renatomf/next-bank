import { describe, expect, it } from 'vitest';
import { ChangePin } from '../../../../src/modules/identity/application/change-pin.ts';
import {
  InvalidPin,
  PasswordIncorrect,
  PinNotCreated,
  TooManyAttempts,
} from '../../../../src/modules/identity/domain/errors.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import {
  FakeHasher,
  FakeLoginAttemptsStore,
  FixedClock,
  InMemoryDatabase,
  SequentialIds,
} from './fakes.ts';

// Changing the PIN needs the password (domain-model.md 3.1), whose wrong
// guesses count with the login's (AUTH-01, week 7 plan); it recovers a locked
// PIN (D5). The user comes from the token.
const NOW = new Date('2026-10-09T12:00:00.000Z');
// The fake hasher matches by length: this password hashes to "hashed(22)".
const PASSWORD = 'violet staple orbit 42';

function setup({ withPin = true } = {}) {
  const db = new InMemoryDatabase();
  db.users.push({
    state: {
      id: 'ana',
      name: 'Ana Teste',
      email: 'ana@example.test',
      cpf: Cpf.parse('123.456.789-09'), // fictitious textbook CPF
      passwordHash: 'hashed(22)',
      status: 'ACTIVE',
      createdAt: NOW,
    },
    cpf: { ciphertext: new Uint8Array(), blindIndex: new Uint8Array(), masked: '', keyVersion: 1 },
  });
  if (withPin) {
    db.transactionPins.push({
      userId: 'ana',
      pinHash: 'old-pin-hash',
      failedAttempts: 5,
      lockedUntil: new Date(NOW.getTime() + 60_000),
      recentLocks: [NOW],
      resetRequired: true,
      updatedAt: NOW,
    });
  }
  const hasher = new FakeHasher();
  const pinHasher = new FakeHasher();
  const attempts = new FakeLoginAttemptsStore();
  const changePin = new ChangePin({
    unitOfWork: db,
    repositories: db,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    hasher,
    pinHasher,
    attempts,
  });
  return { db, hasher, pinHasher, attempts, changePin };
}

const input = { userId: 'ana', password: PASSWORD, newPin: '1597', requestId: 'req-1' };

describe('ChangePin', () => {
  it('stores the new PIN hash, lifting every lock', async () => {
    const { db, pinHasher, changePin } = setup();

    await changePin.execute(input);

    expect(pinHasher.hashed).toEqual(['1597']);
    expect(db.transactionPins[0]).toEqual({
      userId: 'ana',
      pinHash: 'hashed(4)',
      failedAttempts: 0,
      lockedUntil: null,
      recentLocks: [],
      resetRequired: false,
      updatedAt: NOW,
    });
  });

  it('records PIN_CHANGED with neither the PIN nor the password', async () => {
    const { db, changePin } = setup();

    await changePin.execute(input);

    expect(db.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIN_CHANGED',
        actorId: 'ana',
        subjectType: 'USER',
        subjectId: 'ana',
        requestId: 'req-1',
        metadata: {},
      }),
    ]);
  });

  it('refuses a wrong password, keeping the PIN, and counts it', async () => {
    const { db, attempts, changePin } = setup();

    await expect(changePin.execute({ ...input, password: 'wrong' })).rejects.toBeInstanceOf(
      PasswordIncorrect,
    );

    expect(db.transactionPins[0]?.pinHash).toBe('old-pin-hash');
    expect(attempts.get('ana@example.test')?.recentFailures).toHaveLength(1);
  });

  it('clears the counted attempts once the password is right', async () => {
    const { attempts, changePin } = setup();
    await changePin.execute({ ...input, password: 'wrong' }).catch(() => undefined);

    await changePin.execute(input);

    expect(attempts.get('ana@example.test')).toBeUndefined();
  });

  // AUTH-01: the login's block holds here, before any hashing.
  it('refuses at once while the account is blocked', async () => {
    const { hasher, attempts, changePin } = setup();
    attempts.set('ana@example.test', {
      recentFailures: [],
      blockedUntil: new Date(NOW.getTime() + 60_000),
      consecutiveBlocks: 1,
    });

    await expect(changePin.execute(input)).rejects.toBeInstanceOf(TooManyAttempts);
    expect(hasher.verified).toEqual([]);
  });

  it('refuses a trivial PIN before checking the password', async () => {
    const { hasher, attempts, changePin } = setup();

    await expect(changePin.execute({ ...input, newPin: '1234' })).rejects.toBeInstanceOf(
      InvalidPin,
    );
    expect(hasher.verified).toEqual([]);
    expect(attempts.entries.size).toBe(0);
  });

  it('asks to create the PIN first', async () => {
    const { db, changePin } = setup({ withPin: false });

    await expect(changePin.execute(input)).rejects.toBeInstanceOf(PinNotCreated);
    expect(db.auditEvents).toEqual([]);
  });
});
