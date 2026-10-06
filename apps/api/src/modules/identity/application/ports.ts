import type { AuditTrail } from '../../../shared/application/ports.ts';
import type { Cpf } from '../domain/cpf.ts';
import type { SessionState } from '../domain/session.ts';
import type { UserState } from '../domain/user.ts';

/** One-way hashing for passwords and PINs. The secret itself is never stored. */
export interface SecretHasher {
  hash(secret: string): Promise<string>;
  verify(hash: string, secret: string): Promise<boolean>;
}

export interface EncryptedCpf {
  ciphertext: Uint8Array;
  /** Which key encrypted it, so keys can be rotated gradually. */
  keyVersion: number;
}

/**
 * Protects the CPF at rest (database.md, section 2): encrypted for storage, and a
 * keyed blind index to enforce uniqueness without storing it in clear.
 */
export interface CpfProtector {
  encrypt(cpf: Cpf): EncryptedCpf;
  decrypt(encrypted: EncryptedCpf): Cpf;
  blindIndex(cpf: Cpf): Uint8Array;
}

/** A new opaque refresh token: the value goes to the client, only the hash is stored. */
export interface RefreshTokenGenerator {
  generate(): { token: string; hash: Uint8Array };
}

/** Short-lived access token (ADR 0004: EdDSA JWT, 15 minutes). */
export interface AccessTokenIssuer {
  issue(input: {
    userId: string;
    sessionId: string;
    now: Date;
  }): Promise<{ token: string; expiresAt: Date }>;
}

/** How the CPF is stored: never in clear. */
export interface StoredCpf {
  ciphertext: Uint8Array;
  blindIndex: Uint8Array;
  masked: string;
  keyVersion: number;
}

export interface StoredRefreshToken {
  id: string;
  sessionId: string;
  tokenHash: Uint8Array;
  createdAt: Date;
}

export interface UsersRepository {
  existsWithEmailOrCpf(email: string, cpfBlindIndex: Uint8Array): Promise<boolean>;
  insert(user: UserState, cpf: StoredCpf): Promise<void>;
}

export interface SessionsRepository {
  insert(session: SessionState): Promise<void>;
}

export interface RefreshTokensRepository {
  insert(token: StoredRefreshToken): Promise<void>;
}

/** Everything a use case reads or writes inside one database transaction. */
export interface IdentityTransaction {
  users: UsersRepository;
  sessions: SessionsRepository;
  refreshTokens: RefreshTokensRepository;
  audit: AuditTrail;
}

/** Runs the work in a single transaction: all writes are committed, or none. */
export interface IdentityUnitOfWork {
  run<T>(work: (tx: IdentityTransaction) => Promise<T>): Promise<T>;
}
