import { describe, expect, it } from 'vitest';
import { CreatePin } from '../../../../src/modules/identity/application/create-pin.ts';
import { InvalidPin, PinAlreadyCreated } from '../../../../src/modules/identity/domain/errors.ts';
import { FakeHasher, FixedClock, InMemoryDatabase, SequentialIds } from './fakes.ts';

// Transaction PIN creation (domain-model.md 3.1 and 8; threat model D7, API-13).
const NOW = new Date('2026-10-06T12:00:00.000Z');

function setup() {
  const db = new InMemoryDatabase();
  const pinHasher = new FakeHasher();
  const createPin = new CreatePin({
    unitOfWork: db,
    repositories: db,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    pinHasher,
  });
  return { db, pinHasher, createPin };
}

const input = { userId: 'user-1', pin: '2580', requestId: 'req-pin-1' };

describe('CreatePin', () => {
  it('stores only the hash of the PIN, unlocked and without failed attempts', async () => {
    const { db, pinHasher, createPin } = setup();

    await createPin.execute(input);

    expect(pinHasher.hashed).toEqual(['2580']);
    expect(db.transactionPins).toEqual([
      {
        userId: 'user-1',
        pinHash: 'hashed(4)',
        failedAttempts: 0,
        lockedUntil: null,
        recentLocks: [],
        resetRequired: false,
        updatedAt: NOW,
      },
    ]);
  });

  it('records PIN_CREATED with the request id and no PIN in the metadata', async () => {
    const { db, createPin } = setup();

    await createPin.execute(input);

    expect(db.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIN_CREATED',
        actorType: 'USER',
        actorId: 'user-1',
        subjectType: 'USER',
        subjectId: 'user-1',
        requestId: 'req-pin-1',
        metadata: {},
      }),
    ]);
    expect(JSON.stringify(db.auditEvents)).not.toContain('2580');
  });

  it.each(['0000', '1234', '9876', '12a4', '258', '25801'])(
    'refuses %s before hashing or writing anything (InvalidPin)',
    async (pin) => {
      const { db, pinHasher, createPin } = setup();

      await expect(createPin.execute({ ...input, pin })).rejects.toThrow(InvalidPin);
      expect(pinHasher.hashed).toEqual([]);
      expect(db.runs).toBe(0);
    },
  );

  it('creates the PIN only once: changing it needs the password (PinAlreadyCreated, D7)', async () => {
    const { db, createPin } = setup();
    await createPin.execute(input);

    await expect(createPin.execute({ ...input, pin: '7413' })).rejects.toThrow(PinAlreadyCreated);
    expect(db.transactionPins).toHaveLength(1);
    expect(db.auditEvents).toHaveLength(1);
  });
});
