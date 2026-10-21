import { AesGcmPiiProtector } from '../../../shared/infrastructure/aes-gcm-pii-protector.ts';
import type { PhoneProtector, ProtectedPhone } from '../application/ports.ts';

/**
 * The top-up number encrypted with AES-256-GCM under its own key, apart from
 * the CPF's (TOP-01, decision R6), bound to its column by the associated
 * data. Top-ups are never searched by number, so no blind index is made; the
 * shared protector still asks for an HMAC key, which is never used here.
 */
export class AesGcmPhoneProtector implements PhoneProtector {
  readonly #protector: AesGcmPiiProtector;

  constructor(keys: { encryptionKey: Uint8Array; unusedHmacKey: Uint8Array }) {
    this.#protector = new AesGcmPiiProtector(
      { keyVersion: 1, encryptionKey: keys.encryptionKey, hmacKey: keys.unusedHmacKey },
      { associatedData: 'top_ups.top_ups.phone', indexPrefix: 'top-up-phone' },
    );
  }

  protect(digits: string): ProtectedPhone {
    return this.#protector.encrypt(digits);
  }
}
