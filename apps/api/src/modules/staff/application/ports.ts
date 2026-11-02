import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { StaffMemberState } from '../domain/staff-member.ts';
import type { StaffSessionState } from '../domain/staff-session.ts';

/** A secret sealed with the staff's own key (S5); only infrastructure opens it. */
export interface SealedSecret {
  ciphertext: Uint8Array;
  keyVersion: number;
}

/** A member as stored, with what only the login reads. */
export interface StaffMemberRecord {
  state: StaffMemberState;
  passwordHash: string;
  totpSecret: SealedSecret;
}

export interface StaffMembersRepository {
  findByEmail(email: string): Promise<StaffMemberRecord | null>;
  /** The member locked for the rest of the transaction (the TOTP step, STF-01). */
  lock(id: string): Promise<StaffMemberState | null>;
  insert(record: StaffMemberRecord): Promise<void>;
  /** Only what a login changes: the last TOTP step. */
  update(state: StaffMemberState): Promise<void>;
}

export interface StaffSessionsRepository {
  insert(state: StaffSessionState, tokenHash: Uint8Array): Promise<void>;
  /** The session of a token and its member, both read as they are now. */
  findByTokenHash(
    tokenHash: Uint8Array,
  ): Promise<{ session: StaffSessionState; member: StaffMemberState } | null>;
  /** The session locked for the rest of the transaction. */
  lock(id: string): Promise<StaffSessionState | null>;
  /** Only its last use and its revocation. */
  update(state: StaffSessionState): Promise<void>;
}

export interface StaffRepositories {
  members: StaffMembersRepository;
  sessions: StaffSessionsRepository;
  audit: AuditTrail;
}

export interface StaffRepositoriesFactory {
  for(tx: Transaction): StaffRepositories;
}

/** Argon2id, as for the customers' passwords (AUTH-08). */
export interface SecretHasher {
  hash(secret: string): Promise<string>;
  verify(hash: string, secret: string): Promise<boolean>;
}

/** TOTP (RFC 6238, S3). */
export interface TotpVerifier {
  /** The step of [code] for [secret] at [now], within the tolerance, or null. */
  stepOf(secret: string, code: string, now: Date): number | null;
  /** A new random secret, in base32. */
  newSecret(): string;
  /** The otpauth:// link an authenticator reads. */
  uriFor(secret: string, account: string): string;
}

export interface SecretBox {
  seal(secret: string): SealedSecret;
  open(sealed: SealedSecret): string;
}

/** Opaque session tokens, stored only as their hash (S1). */
export interface SessionTokens {
  generate(): { token: string; hash: Uint8Array };
  /** The hash of a well-formed token, or null for anything else. */
  hash(token: string): Uint8Array | null;
}
