import { describe, expect, it } from 'vitest';
import { GetProfile } from '../../../../src/modules/identity/application/get-profile.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import { Unauthenticated } from '../../../../src/modules/identity/domain/errors.ts';
import { InMemoryDatabase } from './fakes.ts';

// The caller's own profile: what the app needs to greet the customer and to
// know whether the PIN step is still pending (week 4 plan, task 1).
const NOW = new Date('2026-10-07T12:00:00.000Z');

function setup() {
  const db = new InMemoryDatabase();
  db.users.push({
    state: {
      id: 'user-1',
      name: 'Maria Teste',
      email: 'maria@example.test',
      cpf: Cpf.parse('123.456.789-09'), // fictitious textbook CPF
      passwordHash: 'hashed(22)',
      status: 'ACTIVE',
      createdAt: NOW,
    },
    cpf: { ciphertext: new Uint8Array(), blindIndex: new Uint8Array(), masked: '', keyVersion: 1 },
  });
  return { db, getProfile: new GetProfile({ unitOfWork: db, repositories: db }) };
}

describe('GetProfile', () => {
  it('returns the name, the masked CPF and that the PIN is still pending', async () => {
    const { getProfile } = setup();

    await expect(getProfile.execute('user-1')).resolves.toEqual({
      name: 'Maria Teste',
      cpfMasked: '***.456.789-**',
      hasPin: false,
    });
  });

  it('reports the PIN once it exists', async () => {
    const { db, getProfile } = setup();
    db.transactionPins.push({
      userId: 'user-1',
      pinHash: 'hashed(4)',
      failedAttempts: 0,
      lockedUntil: null,
      recentLocks: [],
      resetRequired: false,
      updatedAt: NOW,
    });

    await expect(getProfile.execute('user-1')).resolves.toEqual({
      name: 'Maria Teste',
      cpfMasked: '***.456.789-**',
      hasPin: true,
    });
  });

  it('treats a token of a user that does not exist as unauthenticated', async () => {
    const { getProfile } = setup();

    await expect(getProfile.execute('user-unknown')).rejects.toBeInstanceOf(Unauthenticated);
  });
});
