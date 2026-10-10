import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Cpf } from '../../../shared/domain/cpf.ts';
import type { IssuedRefreshToken, SessionState } from '../domain/session.ts';
import type { LoginAttemptsState } from '../domain/login-attempts.ts';
import type { TransactionPinState } from '../domain/transaction-pin.ts';
import type { UserState, UserStatus } from '../domain/user.ts';

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

/** Opaque refresh tokens: the value goes to the client, only the hash is stored. */
export interface RefreshTokenGenerator {
  generate(): { token: string; hash: Uint8Array };
  /** Hash of a presented token, or null when it is not a token this server could have issued. */
  hash(token: string): Uint8Array | null;
}

/**
 * Short-lived access token (ADR 0004: EdDSA JWT, 15 minutes). This port is also
 * where a KMS would plug in: with a KMS the key never leaves it, so signing moves
 * behind this interface rather than behind a separate key provider.
 */
export interface AccessTokenIssuer {
  issue(input: {
    userId: string;
    sessionId: string;
    now: Date;
  }): Promise<{ token: string; expiresAt: Date }>;
}

/** Checks an access token; throws Unauthenticated when it cannot be trusted. */
export interface AccessTokenVerifier {
  verify(token: string, now: Date): Promise<{ userId: string; sessionId: string }>;
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

/** What login needs about an account; never the CPF or other personal data. */
export interface LoginAccount {
  id: string;
  passwordHash: string;
  status: UserStatus;
}

/** What confirming the signed-in customer's password needs: the key of the login's counter and the hash. */
export interface Credentials {
  email: string;
  passwordHash: string;
}

/** What the customer sees about themselves; never the CPF, e-mail or hashes. */
export interface Profile {
  name: string;
  hasPin: boolean;
}

/** Who receives a Pix, for the payer's screen and receipt: never the full CPF. */
export interface Payee {
  name: string;
  documentMasked: string;
}

export interface UsersRepository {
  existsWithEmailOrCpf(email: string, cpfBlindIndex: Uint8Array): Promise<boolean>;
  findByEmail(email: string): Promise<LoginAccount | null>;
  insert(user: UserState, cpf: StoredCpf): Promise<void>;
  findProfile(id: string): Promise<Profile | null>;
  findPayee(id: string): Promise<Payee | null>;
  findCredentials(id: string): Promise<Credentials | null>;
}

export interface SessionsRepository {
  insert(session: SessionState): Promise<void>;
  /** Plain read, no lock: for checking that a session is still active (AUTH-04). */
  findById(id: string): Promise<SessionState | null>;
  /**
   * Reads the session and locks it until the transaction ends, so refreshes and
   * logouts of one session run one at a time.
   */
  lockById(id: string): Promise<SessionState | null>;
  /** The user's sessions still active at [now], most recently used first. */
  listActive(userId: string, now: Date): Promise<SessionState[]>;
  update(session: SessionState): Promise<void>;
}

export interface RefreshTokensRepository {
  insert(token: StoredRefreshToken): Promise<void>;
  findByHash(tokenHash: Uint8Array): Promise<IssuedRefreshToken | null>;
  /** Id of the session's token that can still be refreshed, if any. */
  findActive(sessionId: string): Promise<string | null>;
  markReplaced(id: string, replacedById: string, replacedAt: Date): Promise<void>;
}

/** The identity repositories and the audit trail, all bound to one transaction. */
export interface TransactionPinsRepository {
  /** Fails with PinAlreadyCreated when the user already has a PIN. */
  insert(pin: TransactionPinState): Promise<void>;
  /**
   * Reads the PIN and locks it until the transaction ends, so every attempt is
   * counted once even when guesses arrive in parallel (PIX-05).
   */
  lockByUserId(userId: string): Promise<TransactionPinState | null>;
  update(pin: TransactionPinState): Promise<void>;
}

export interface IdentityRepositories {
  users: UsersRepository;
  sessions: SessionsRepository;
  refreshTokens: RefreshTokensRepository;
  transactionPins: TransactionPinsRepository;
  audit: AuditTrail;
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface IdentityRepositoriesFactory {
  for(tx: Transaction): IdentityRepositories;
}

/** Login attempt counters per account (AUTH-01), keyed by the normalized e-mail. */
export interface LoginAttemptsStore {
  get(key: string): LoginAttemptsState | undefined;
  set(key: string, state: LoginAttemptsState): void;
  delete(key: string): void;
}
