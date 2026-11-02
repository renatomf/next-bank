import type {
  SealedSecret,
  SecretBox,
  SessionTokens,
  StaffMemberRecord,
  StaffRepositories,
  StaffRepositoriesFactory,
  TotpVerifier,
} from '../../../../src/modules/staff/application/ports.ts';
import type { StaffMemberState } from '../../../../src/modules/staff/domain/staff-member.ts';
import type { StaffSessionState } from '../../../../src/modules/staff/domain/staff-session.ts';
import type {
  AuditEvent,
  Transaction,
  UnitOfWork,
} from '../../../../src/shared/application/ports.ts';

export {
  FakeHasher,
  FakeLoginAttemptsStore,
  FixedClock,
  SequentialIds,
} from '../../identity/application/fakes.ts';

/** A secret "sealed" in the clear, marked, so a test sees it never leaves sealed. */
export class FakeSecretBox implements SecretBox {
  seal(value: string): SealedSecret {
    return { ciphertext: Buffer.from(`sealed:${value}`), keyVersion: 1 };
  }

  open(sealed: SealedSecret): string {
    return Buffer.from(sealed.ciphertext)
      .toString()
      .replace(/^sealed:/, '');
  }
}

/**
 * Codes as the test decides: [codes] maps a code to the step it belongs to
 * now; any other code is wrong. Secrets are numbered, never random.
 */
export class FakeTotp implements TotpVerifier {
  readonly codes = new Map<string, number>();
  #next = 1;

  stepOf(_secret: string, code: string): number | null {
    return this.codes.get(code) ?? null;
  }

  newSecret(): string {
    return `SECRET${String(this.#next++)}`;
  }

  uriFor(secret: string, account: string): string {
    return `otpauth://totp/next%20bank:${account}?secret=${secret}`;
  }
}

/** Tokens numbered in order; the hash is the token's own bytes. */
export class SequentialTokens implements SessionTokens {
  #next = 1;

  generate(): { token: string; hash: Uint8Array } {
    const token = `token-${String(this.#next++)}`;
    return { token, hash: Buffer.from(token) };
  }

  hash(token: string): Uint8Array | null {
    return token.startsWith('token-') ? Buffer.from(token) : null;
  }
}

interface StoredSession {
  state: StaffSessionState;
  tokenHash: string;
}

/** The staff's tables in memory; one "transaction" at a time, as the tests run. */
export class InMemoryStaffDatabase implements UnitOfWork, StaffRepositoriesFactory {
  readonly members = new Map<string, StaffMemberRecord>();
  readonly sessions = new Map<string, StoredSession>();
  readonly audit: AuditEvent[] = [];

  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return work({ kind: 'transaction' });
  }

  for(): StaffRepositories {
    return {
      members: {
        findByEmail: (email) =>
          Promise.resolve(
            [...this.members.values()].find((member) => member.state.email === email) ?? null,
          ),
        lock: (id) => Promise.resolve(this.members.get(id)?.state ?? null),
        insert: (record) => {
          if ([...this.members.values()].some((m) => m.state.email === record.state.email)) {
            return Promise.reject(new Error('duplicate key value violates unique constraint'));
          }
          this.members.set(record.state.id, record);
          return Promise.resolve();
        },
        update: (state) => {
          const record = this.members.get(state.id);
          if (record) this.members.set(state.id, { ...record, state });
          return Promise.resolve();
        },
      },
      sessions: {
        insert: (state, tokenHash) => {
          this.sessions.set(state.id, { state, tokenHash: Buffer.from(tokenHash).toString() });
          return Promise.resolve();
        },
        findByTokenHash: (hash) => {
          const found = [...this.sessions.values()].find(
            (session) => session.tokenHash === Buffer.from(hash).toString(),
          );
          const member = found && this.members.get(found.state.memberId);
          return Promise.resolve(
            found && member ? { session: found.state, member: member.state } : null,
          );
        },
        lock: (id) => Promise.resolve(this.sessions.get(id)?.state ?? null),
        update: (state) => {
          const stored = this.sessions.get(state.id);
          if (stored) this.sessions.set(state.id, { ...stored, state });
          return Promise.resolve();
        },
      },
      audit: {
        record: (event) => {
          this.audit.push(event);
          return Promise.resolve();
        },
      },
    };
  }

  /** Adds a member as the script would leave it. */
  add(state: StaffMemberState, password: string, totpSecret: string): void {
    this.members.set(state.id, {
      state,
      // The format of FakeHasher: it matches by the password's length.
      passwordHash: `hashed(${String(password.length)})`,
      totpSecret: new FakeSecretBox().seal(totpSecret),
    });
  }

  actions(): string[] {
    return this.audit.map((event) => event.action);
  }
}
