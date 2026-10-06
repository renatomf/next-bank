import type {
  AuditEvent,
  AuditTrail,
  Clock,
  IdGenerator,
} from '../../../../src/shared/application/ports.ts';
import type {
  AccessTokenIssuer,
  CpfProtector,
  EncryptedCpf,
  IdentityTransaction,
  IdentityUnitOfWork,
  RefreshTokenGenerator,
  SecretHasher,
  StoredRefreshToken,
} from '../../../../src/modules/identity/application/ports.ts';
import { Cpf } from '../../../../src/modules/identity/domain/cpf.ts';
import type { SessionState } from '../../../../src/modules/identity/domain/session.ts';
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
  verify(): Promise<boolean> {
    return Promise.resolve(false);
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
}

/**
 * In-memory unit of work: writes are staged and only become visible on
 * success, like a database transaction.
 */
export class InMemoryIdentityStore implements IdentityUnitOfWork {
  users: StoredUser[] = [];
  sessions: SessionState[] = [];
  refreshTokens: StoredRefreshToken[] = [];
  auditEvents: AuditEvent[] = [];
  /** Makes the next audit write fail, to prove all writes roll back together. */
  failNextAudit = false;

  async run<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T> {
    const staged = {
      users: [...this.users],
      sessions: [...this.sessions],
      refreshTokens: [...this.refreshTokens],
      auditEvents: [...this.auditEvents],
    };
    const audit: AuditTrail = {
      record: (event) => {
        if (this.failNextAudit) {
          this.failNextAudit = false;
          return Promise.reject(new Error('audit write failed'));
        }
        staged.auditEvents.push(event);
        return Promise.resolve();
      },
    };
    const result = await work({
      users: {
        existsWithEmailOrCpf: (email, cpfBlindIndex) =>
          Promise.resolve(
            staged.users.some(
              (u) =>
                u.state.email === email ||
                Buffer.from(u.cpf.blindIndex).equals(Buffer.from(cpfBlindIndex)),
            ),
          ),
        insert: (user, cpf) => {
          staged.users.push({ state: user, cpf });
          return Promise.resolve();
        },
      },
      sessions: {
        insert: (session) => {
          staged.sessions.push(session);
          return Promise.resolve();
        },
      },
      refreshTokens: {
        insert: (token) => {
          staged.refreshTokens.push(token);
          return Promise.resolve();
        },
      },
      audit,
    });
    Object.assign(this, staged);
    return result;
  }
}
