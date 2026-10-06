import type { Cpf } from '../domain/cpf.ts';

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
