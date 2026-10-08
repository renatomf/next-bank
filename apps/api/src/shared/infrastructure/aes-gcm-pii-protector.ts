import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface PiiKeys {
  keyVersion: number;
  /** AES-256-GCM key (PII_ENCRYPTION_KEY). */
  encryptionKey: Uint8Array;
  /** HMAC-SHA256 key for the blind index (PII_HMAC_KEY). */
  hmacKey: Uint8Array;
}

/** What one kind of value is bound to, so values of different kinds never mix. */
export interface PiiPurpose {
  /** Bound to every ciphertext with the key version, e.g. "identity.users.cpf". */
  associatedData: string;
  /** Prefixed to the value before the blind index, e.g. "cpf". */
  indexPrefix: string;
}

export interface EncryptedPii {
  ciphertext: Uint8Array;
  keyVersion: number;
}

/**
 * Personal sensitive data encrypted in the application (database.md, section 2).
 * AES-256-GCM with a random 96-bit nonce per value. Stored layout:
 * nonce (12 bytes) | auth tag (16 bytes) | ciphertext. The purpose and the key
 * version are bound as associated data, so a value cannot be passed off as
 * another kind or another version.
 */
export class AesGcmPiiProtector {
  readonly #keys: PiiKeys;
  readonly #purpose: PiiPurpose;

  constructor(keys: PiiKeys, purpose: PiiPurpose) {
    if (keys.encryptionKey.length !== KEY_BYTES || keys.hmacKey.length !== KEY_BYTES) {
      throw new Error('PII keys must be 32 bytes');
    }
    this.#keys = keys;
    this.#purpose = purpose;
  }

  encrypt(value: string): EncryptedPii {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.#keys.encryptionKey, nonce, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(this.#associatedData(this.#keys.keyVersion));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]),
      keyVersion: this.#keys.keyVersion,
    };
  }

  decrypt({ ciphertext, keyVersion }: EncryptedPii): string {
    if (keyVersion !== this.#keys.keyVersion) {
      throw new Error(`Unknown PII key version ${String(keyVersion)}`);
    }
    // A shorter value would yield a truncated tag, which is far easier to forge.
    if (ciphertext.length <= NONCE_BYTES + TAG_BYTES) {
      throw new Error('PII ciphertext is too short');
    }
    const nonce = ciphertext.subarray(0, NONCE_BYTES);
    const tag = ciphertext.subarray(NONCE_BYTES, NONCE_BYTES + TAG_BYTES);
    // authTagLength makes Node refuse any tag that is not exactly 16 bytes.
    const decipher = createDecipheriv('aes-256-gcm', this.#keys.encryptionKey, nonce, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(this.#associatedData(keyVersion));
    decipher.setAuthTag(tag);
    // final() throws if the ciphertext, tag or associated data was changed.
    return Buffer.concat([
      decipher.update(ciphertext.subarray(NONCE_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Same value, purpose and key give the same index; without the key it cannot be precomputed. */
  blindIndex(value: string): Uint8Array {
    return createHmac('sha256', this.#keys.hmacKey)
      .update(`${this.#purpose.indexPrefix}:${value}`)
      .digest();
  }

  #associatedData(keyVersion: number): Buffer {
    return Buffer.from(`${this.#purpose.associatedData}:v${String(keyVersion)}`);
  }
}
