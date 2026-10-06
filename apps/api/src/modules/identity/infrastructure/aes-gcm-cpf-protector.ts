import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { CpfProtector, EncryptedCpf } from '../application/ports.ts';
import { Cpf } from '../domain/cpf.ts';

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface CpfKeys {
  keyVersion: number;
  /** AES-256-GCM key (PII_ENCRYPTION_KEY). */
  encryptionKey: Uint8Array;
  /** HMAC-SHA256 key for the blind index (PII_HMAC_KEY). */
  hmacKey: Uint8Array;
}

/**
 * AES-256-GCM with a random 96-bit nonce per value. Stored layout:
 * nonce (12 bytes) | auth tag (16 bytes) | ciphertext. The key version is bound
 * as associated data, so a value cannot be passed off as another version's.
 */
export class AesGcmCpfProtector implements CpfProtector {
  readonly #keys: CpfKeys;

  constructor(keys: CpfKeys) {
    if (keys.encryptionKey.length !== KEY_BYTES || keys.hmacKey.length !== KEY_BYTES) {
      throw new Error('CPF keys must be 32 bytes');
    }
    this.#keys = keys;
  }

  encrypt(cpf: Cpf): EncryptedCpf {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.#keys.encryptionKey, nonce);
    cipher.setAAD(this.#associatedData(this.#keys.keyVersion));
    const ciphertext = Buffer.concat([cipher.update(cpf.digits, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]),
      keyVersion: this.#keys.keyVersion,
    };
  }

  decrypt({ ciphertext, keyVersion }: EncryptedCpf): Cpf {
    if (keyVersion !== this.#keys.keyVersion) {
      throw new Error(`Unknown CPF key version ${String(keyVersion)}`);
    }
    const nonce = ciphertext.subarray(0, NONCE_BYTES);
    const tag = ciphertext.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.#keys.encryptionKey, nonce);
    decipher.setAAD(this.#associatedData(keyVersion));
    decipher.setAuthTag(tag);
    // final() throws if the ciphertext, tag or associated data was changed.
    const digits = Buffer.concat([
      decipher.update(ciphertext.subarray(NONCE_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    return Cpf.parse(digits);
  }

  /** Same CPF and key give the same index; without the key it cannot be precomputed. */
  blindIndex(cpf: Cpf): Uint8Array {
    return createHmac('sha256', this.#keys.hmacKey).update(`cpf:${cpf.digits}`).digest();
  }

  #associatedData(keyVersion: number): Buffer {
    return Buffer.from(`identity.users.cpf:v${String(keyVersion)}`);
  }
}
