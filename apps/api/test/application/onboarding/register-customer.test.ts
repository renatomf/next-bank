import { describe, expect, it } from 'vitest';
import { RegisterCustomer } from '../../../src/application/onboarding/register-customer.ts';
import { RegisterUser } from '../../../src/modules/identity/application/register-user.ts';
import {
  AlreadyRegistered,
  InvalidCpf,
  WeakPassword,
} from '../../../src/modules/identity/domain/errors.ts';
import {
  FakeAccessTokens,
  FakeCpfProtector,
  FakeHasher,
  FakeRefreshTokens,
  FixedClock,
  InMemoryDatabase,
  SequentialIds,
} from '../../modules/identity/application/fakes.ts';

// Registration (domain-model.md, section 8; ADR 0010): the orchestrator sequences
// identity's steps around one shared transaction. Account, funding and the Pix
// key join it in weeks 4-5.
const NOW = new Date('2026-10-06T12:00:00.000Z');
const INPUT = {
  name: 'Maria Teste',
  email: 'Maria@Example.test',
  cpf: '123.456.789-09', // fictitious textbook CPF
  password: 'violet staple orbit 42',
  deviceLabel: 'Pixel 8',
  requestId: 'req-12345678',
};

function setup() {
  const store = new InMemoryDatabase();
  const hasher = new FakeHasher();
  const identity = new RegisterUser({
    repositories: store,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    hasher,
    cpfProtector: new FakeCpfProtector(),
    commonPasswords: { contains: (candidate) => candidate === 'password1234' },
    refreshTokens: new FakeRefreshTokens(),
    accessTokens: new FakeAccessTokens(),
  });
  const register = new RegisterCustomer({ unitOfWork: store, identity });
  return { store, hasher, register };
}

describe('RegisterCustomer', () => {
  it('creates the user with a normalized e-mail, the hashed password and the protected CPF', async () => {
    const { store, register } = setup();

    await register.execute(INPUT);

    expect(store.users).toHaveLength(1);
    const [user] = store.users;
    expect(user?.state).toMatchObject({
      id: 'id-1',
      name: 'Maria Teste',
      email: 'maria@example.test',
      passwordHash: 'hashed(22)',
      status: 'ACTIVE',
      createdAt: NOW,
    });
    expect(user?.cpf).toEqual({
      ciphertext: new TextEncoder().encode('enc:12345678909'),
      blindIndex: new TextEncoder().encode('idx:12345678909'),
      masked: '***.456.789-**',
      keyVersion: 1,
    });
  });

  it('opens a session and stores only the hash of the refresh token (AUTH-03)', async () => {
    const { store, register } = setup();

    await register.execute(INPUT);

    expect(store.sessions).toEqual([
      expect.objectContaining({
        id: 'id-2',
        userId: 'id-1',
        deviceLabel: 'Pixel 8',
        createdAt: NOW,
      }),
    ]);
    expect(store.refreshTokens).toEqual([
      {
        id: 'id-3',
        sessionId: 'id-2',
        tokenHash: new TextEncoder().encode('hash-of-refresh'),
        createdAt: NOW,
      },
    ]);
    expect(JSON.stringify(store.refreshTokens)).not.toContain('refresh-token-value');
  });

  it('returns the tokens for the new session', async () => {
    const { register } = setup();

    const result = await register.execute(INPUT);

    expect(result).toEqual({
      userId: 'id-1',
      sessionId: 'id-2',
      accessToken: 'access(id-1,id-2)',
      accessTokenExpiresAt: new Date('2026-10-06T12:15:00.000Z'),
      refreshToken: 'refresh-token-value',
    });
  });

  it('records the audit trail with the request id and no personal data', async () => {
    const { store, register } = setup();

    await register.execute(INPUT);

    expect(store.auditEvents.map((e) => e.action)).toEqual(['USER_REGISTERED', 'SESSION_CREATED']);
    expect(store.auditEvents[0]).toMatchObject({
      actorType: 'USER',
      actorId: 'id-1',
      subjectType: 'USER',
      subjectId: 'id-1',
      requestId: 'req-12345678',
      occurredAt: NOW,
    });
    expect(store.auditEvents[1]).toMatchObject({ subjectType: 'SESSION', subjectId: 'id-2' });
    const serialized = JSON.stringify(store.auditEvents);
    for (const personal of ['12345678909', 'maria@example.test', 'Maria Teste', INPUT.password]) {
      expect(serialized).not.toContain(personal);
    }
  });

  it('refuses invalid data before opening any transaction', async () => {
    const { store, register } = setup();

    await expect(register.execute({ ...INPUT, cpf: '123.456.789-00' })).rejects.toThrow(InvalidCpf);
    await expect(register.execute({ ...INPUT, password: 'short' })).rejects.toThrow(WeakPassword);
    expect(store.runs).toBe(0);
  });

  it('rejects an invalid CPF and stores nothing (InvalidCpf)', async () => {
    const { store, register } = setup();

    await expect(register.execute({ ...INPUT, cpf: '123.456.789-00' })).rejects.toThrow(InvalidCpf);
    expect(store.users).toEqual([]);
  });

  it('rejects a common password and stores nothing (WeakPassword, AUTH-07)', async () => {
    const { store, register } = setup();

    await expect(register.execute({ ...INPUT, password: 'Password1234' })).rejects.toThrow(
      WeakPassword,
    );
    expect(store.users).toEqual([]);
  });

  it.each([
    ['e-mail', { email: 'MARIA@example.test', cpf: '111.444.777-35' }],
    ['CPF', { email: 'other@example.test', cpf: '123.456.789-09' }],
  ])('rejects an %s that already has an account (AlreadyRegistered)', async (_case, change) => {
    const { store, register } = setup();
    await register.execute(INPUT);

    await expect(register.execute({ ...INPUT, ...change })).rejects.toThrow(AlreadyRegistered);
    expect(store.users).toHaveLength(1);
  });

  it('hashes the password even when already registered, so timing does not reveal accounts', async () => {
    const { hasher, register } = setup();
    await register.execute(INPUT);

    await expect(register.execute(INPUT)).rejects.toThrow(AlreadyRegistered);
    expect(hasher.hashed).toHaveLength(2);
  });

  it('writes nothing if any step of the transaction fails', async () => {
    const { store, register } = setup();
    store.failNextAudit = true;

    await expect(register.execute(INPUT)).rejects.toThrow('audit write failed');
    expect(store.users).toEqual([]);
    expect(store.sessions).toEqual([]);
    expect(store.refreshTokens).toEqual([]);
  });
});
