import { hkdfSync } from 'node:crypto';
import { AesGcmPiiProtector } from '../../../shared/infrastructure/aes-gcm-pii-protector.ts';
import type { SealedSecret, SecretBox } from '../application/ports.ts';

const KEY_VERSION = 1;

/**
 * The staff's TOTP secrets, sealed with their own key (STAFF_TOTP_KEY, S5)
 * by the same AES-256-GCM as the CPF, bound to their column. The secrets
 * are never searched, so the protector's blind index is never used; its
 * HMAC key is derived from the TOTP key, never another purpose's key.
 */
export class AesGcmSecretBox implements SecretBox {
  readonly #protector: AesGcmPiiProtector;

  constructor(key: Uint8Array) {
    if (key.length !== 32) throw new Error('STAFF_TOTP_KEY must be 32 bytes');
    const unusedIndexKey = Buffer.from(
      hkdfSync('sha256', key, Buffer.alloc(0), 'next-bank staff totp: no blind index', 32),
    );
    this.#protector = new AesGcmPiiProtector(
      { keyVersion: KEY_VERSION, encryptionKey: key, hmacKey: unusedIndexKey },
      { associatedData: 'staff.members.totp_secret', indexPrefix: 'totp' },
    );
  }

  seal(secret: string): SealedSecret {
    return this.#protector.encrypt(secret);
  }

  open(sealed: SealedSecret): string {
    return this.#protector.decrypt(sealed);
  }
}
