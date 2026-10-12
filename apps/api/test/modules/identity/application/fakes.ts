import type {
  AuditEvent,
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../../src/shared/application/ports.ts';
import type {
  AccessTokenIssuer,
  CpfProtector,
  EncryptedCpf,
  IdentityRepositories,
  IdentityRepositoriesFactory,
  LoginAttemptsStore,
  RefreshTokenGenerator,
  SecretHasher,
  StoredRefreshToken,
} from '../../../../src/modules/identity/application/ports.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import type { LoginAttemptsState } from '../../../../src/modules/identity/domain/login-attempts.ts';
import { PinAlreadyCreated } from '../../../../src/modules/identity/domain/errors.ts';
import type { SessionState } from '../../../../src/modules/identity/domain/session.ts';
import type { TransactionPinState } from '../../../../src/modules/identity/domain/transaction-pin.ts';
import type { UserState } from '../../../../src/modules/identity/domain/user.ts';

export class FixedClock implements Clock {
  current: Date;
  constructor(current: Date) {
    this.current = current;
  }
  now(): Date {
    return this.current;
  }
}

export class SequentialIds implements IdGenerator {
  #next = 1;
  next(): string {
    return `id-${String(this.#next++)}`;
  }
}

/** Not a real hash: lets tests see what was hashed and count the calls. */
export class FakeHasher implements SecretHasher {
  hashed: string[] = [];
  hash(secret: string): Promise<string> {
    this.hashed.push(secret);
    return Promise.resolve(`hashed(${String(secret.length)})`);
  }
  /** Hashes checked, in order: shows that every login attempt costs one verification. */
  verified: string[] = [];
  /** Matches when the secret has the length encoded in the fake hash; tests use distinct lengths. */
  verify(hash: string, secret: string): Promise<boolean> {
    this.verified.push(hash);
    return Promise.resolve(hash === `hashed(${String(secret.length)})`);
  }
}

/** Login attempt counters kept in a plain map, keyed by the normalized e-mail. */
export class FakeLoginAttemptsStore implements LoginAttemptsStore {
  readonly entries = new Map<string, LoginAttemptsState>();
  get(key: string): LoginAttemptsState | undefined {
    return this.entries.get(key);
  }
  set(key: string, state: LoginAttemptsState): void {
    this.entries.set(key, state);
  }
  delete(key: string): void {
    this.entries.delete(key);
  }
}

/** Reversible on purpose, so tests can check what was "encrypted". */
export class FakeCpfProtector implements CpfProtector {
  encrypt(cpf: Cpf): EncryptedCpf {
    return { ciphertext: new TextEncoder().encode(`enc:${cpf.digits}`), keyVersion: 1 };
  }
  decrypt({ ciphertext }: EncryptedCpf): Cpf {
    return Cpf.parse(new TextDecoder().decode(ciphertext).slice(4));
  }
  blindIndex(cpf: Cpf): Uint8Array {
    return new TextEncoder().encode(`idx:${cpf.digits}`);
  }
}

export class FakeRefreshTokens implements RefreshTokenGenerator {
  generate() {
    return { token: 'refresh-token-value', hash: new TextEncoder().encode('hash-of-refresh') };
  }
  hash(token: string): Uint8Array | null {
    return token === 'refresh-token-value' ? new TextEncoder().encode('hash-of-refresh') : null;
  }
}

export class FakeAccessTokens implements AccessTokenIssuer {
  issue(input: { userId: string; sessionId: string; now: Date }) {
    return Promise.resolve({
      token: `access(${input.userId},${input.sessionId})`,
      expiresAt: new Date(input.now.getTime() + 15 * 60_000),
    });
  }
}

export interface StoredUser {
  state: UserState;
  cpf: { ciphertext: Uint8Array; blindIndex: Uint8Array; masked: string; keyVersion: number };
  /** Set by the demo seed only (DEMO-03). */
  isDemo?: boolean;
}

interface Tables {
  users: StoredUser[];
  sessions: SessionState[];
  refreshTokens: StoredRefreshToken[];
  /** Token id -> when and by which token it was replaced (rotation). */
  replacements: Map<string, { replacedAt: Date; replacedById: string }>;
  transactionPins: TransactionPinState[];
  auditEvents: AuditEvent[];
}

class InMemoryTransaction implements Transaction {
  readonly kind = 'transaction';
  readonly tables: Tables;
  constructor(tables: Tables) {
    this.tables = tables;
  }
}

/**
 * In-memory database with transaction semantics: each run works on a staged
 * copy that only becomes visible when the work succeeds.
 */
export class InMemoryDatabase implements UnitOfWork, IdentityRepositoriesFactory {
  users: StoredUser[] = [];
  sessions: SessionState[] = [];
  refreshTokens: StoredRefreshToken[] = [];
  replacements = new Map<string, { replacedAt: Date; replacedById: string }>();
  transactionPins: TransactionPinState[] = [];
  auditEvents: AuditEvent[] = [];
  /** How many transactions were opened. */
  runs = 0;
  /** Makes the next audit write fail, to prove all writes roll back together. */
  failNextAudit = false;

  async run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    this.runs += 1;
    const tx = new InMemoryTransaction({
      users: [...this.users],
      sessions: [...this.sessions],
      refreshTokens: [...this.refreshTokens],
      replacements: new Map(this.replacements),
      transactionPins: [...this.transactionPins],
      auditEvents: [...this.auditEvents],
    });
    const result = await work(tx);
    Object.assign(this, tx.tables);
    return result;
  }

  for(tx: Transaction): IdentityRepositories {
    if (!(tx instanceof InMemoryTransaction)) throw new Error('Not an in-memory transaction');
    const { tables } = tx;
    return {
      users: {
        existsWithEmailOrCpf: (email, cpfBlindIndex) =>
          Promise.resolve(
            tables.users.some(
              (u) =>
                u.state.email === email ||
                Buffer.from(u.cpf.blindIndex).equals(Buffer.from(cpfBlindIndex)),
            ),
          ),
        findByEmail: (email) => {
          const found = tables.users.find((u) => u.state.email === email);
          return Promise.resolve(
            found
              ? {
                  id: found.state.id,
                  passwordHash: found.state.passwordHash,
                  status: found.state.status,
                }
              : null,
          );
        },
        insert: (user, cpf) => {
          tables.users.push({ state: user, cpf });
          return Promise.resolve();
        },
        findProfile: (id) => {
          const found = tables.users.find((u) => u.state.id === id);
          return Promise.resolve(
            found
              ? {
                  name: found.state.name,
                  hasPin: tables.transactionPins.some((pin) => pin.userId === id),
                }
              : null,
          );
        },
        lockPasswordHash: (id) =>
          Promise.resolve(tables.users.find((u) => u.state.id === id)?.state.passwordHash ?? null),
        updatePasswordHash: (id, passwordHash) => {
          tables.users = tables.users.map((u) =>
            u.state.id === id ? { ...u, state: { ...u.state, passwordHash } } : u,
          );
          return Promise.resolve();
        },
        findCredentials: (id) => {
          const found = tables.users.find((u) => u.state.id === id);
          return Promise.resolve(
            found
              ? {
                  email: found.state.email,
                  passwordHash: found.state.passwordHash,
                  isDemo: found.isDemo ?? false,
                }
              : null,
          );
        },
        findPayee: (id) => {
          const found = tables.users.find((u) => u.state.id === id);
          return Promise.resolve(
            found ? { name: found.state.name, documentMasked: found.cpf.masked } : null,
          );
        },
      },
      sessions: {
        insert: (session) => {
          tables.sessions.push(session);
          return Promise.resolve();
        },
        findById: (id) => {
          const found = tables.sessions.find((session) => session.id === id);
          return Promise.resolve(found ? { ...found } : null);
        },
        lockById: (id) => {
          const found = tables.sessions.find((session) => session.id === id);
          return Promise.resolve(found ? { ...found } : null);
        },
        lockActiveByUser: (userId, now) =>
          Promise.resolve(
            tables.sessions
              .filter(
                (session) =>
                  session.userId === userId &&
                  session.revokedAt === null &&
                  now < session.idleExpiresAt &&
                  now < session.absoluteExpiresAt,
              )
              .sort((a, b) => a.id.localeCompare(b.id))
              .map((session) => ({ ...session })),
          ),
        listActive: (userId, now) =>
          Promise.resolve(
            tables.sessions
              .filter(
                (session) =>
                  session.userId === userId &&
                  session.revokedAt === null &&
                  now < session.idleExpiresAt &&
                  now < session.absoluteExpiresAt,
              )
              .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
              .map((session) => ({ ...session })),
          ),
        update: (state) => {
          tables.sessions = tables.sessions.map((session) =>
            session.id === state.id ? { ...state } : session,
          );
          return Promise.resolve();
        },
      },
      refreshTokens: {
        insert: (token) => {
          tables.refreshTokens.push(token);
          return Promise.resolve();
        },
        findByHash: (hash) => {
          const found = tables.refreshTokens.find((token) =>
            Buffer.from(token.tokenHash).equals(Buffer.from(hash)),
          );
          const replacement = found ? tables.replacements.get(found.id) : undefined;
          return Promise.resolve(
            found
              ? {
                  id: found.id,
                  sessionId: found.sessionId,
                  replacedAt: replacement?.replacedAt ?? null,
                  replacedById: replacement?.replacedById ?? null,
                }
              : null,
          );
        },
        findActive: (sessionId) => {
          const active = tables.refreshTokens.find(
            (token) => token.sessionId === sessionId && !tables.replacements.has(token.id),
          );
          return Promise.resolve(active ? active.id : null);
        },
        markReplaced: (id, replacedById, replacedAt) => {
          tables.replacements.set(id, { replacedAt, replacedById });
          return Promise.resolve();
        },
      },
      transactionPins: {
        insert: (pin) => {
          // Same rule as the primary key on user_id.
          if (tables.transactionPins.some((existing) => existing.userId === pin.userId)) {
            return Promise.reject(new PinAlreadyCreated());
          }
          tables.transactionPins.push(pin);
          return Promise.resolve();
        },
        lockByUserId: (userId) => {
          const found = tables.transactionPins.find((pin) => pin.userId === userId);
          return Promise.resolve(found ? { ...found, recentLocks: [...found.recentLocks] } : null);
        },
        update: (state) => {
          tables.transactionPins = tables.transactionPins.map((pin) =>
            pin.userId === state.userId ? { ...state } : pin,
          );
          return Promise.resolve();
        },
      },
      audit: {
        record: (event) => {
          if (this.failNextAudit) {
            this.failNextAudit = false;
            return Promise.reject(new Error('audit write failed'));
          }
          tables.auditEvents.push(event);
          return Promise.resolve();
        },
      },
    };
  }
}

/** A different token on every call, so rotations can be told apart. */
export class SequentialRefreshTokens implements RefreshTokenGenerator {
  #next = 1;
  generate() {
    const token = `refresh-${String(this.#next++)}`;
    return { token, hash: hashOf(token) };
  }
  hash(token: string): Uint8Array | null {
    return token.startsWith('refresh-') ? hashOf(token) : null;
  }
}

function hashOf(token: string): Uint8Array {
  return new TextEncoder().encode(`hash-of-${token}`);
}
