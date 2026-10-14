import {
  AesGcmPiiProtector,
  type PiiKeys,
} from '../../../shared/infrastructure/aes-gcm-pii-protector.ts';
import type {
  PixKeyValueProtector,
  ProtectedKeyValue,
  SealedKeyValue,
} from '../application/ports.ts';
import type { PixKeyType } from '../domain/pix-key.ts';

/**
 * Pix key values with the shared AES-256-GCM protector (week 5 plan, D7). Each
 * type has its own index prefix ("pix-key:CPF", "pix-key:EMAIL"...), none of
 * them a prefix of another, so values of different kinds never share an index.
 */
export class AesGcmPixKeyProtector implements PixKeyValueProtector {
  readonly #keys: PiiKeys;
  readonly #byType = new Map<PixKeyType, AesGcmPiiProtector>();

  constructor(keys: PiiKeys) {
    this.#keys = keys;
  }

  protect(type: PixKeyType, value: string): ProtectedKeyValue {
    const protector = this.#for(type);
    const encrypted = protector.encrypt(value);
    return {
      ciphertext: encrypted.ciphertext,
      blindIndex: protector.blindIndex(value),
      keyVersion: encrypted.keyVersion,
    };
  }

  blindIndex(type: PixKeyType, value: string): Uint8Array {
    return this.#for(type).blindIndex(value);
  }

  reveal(type: PixKeyType, sealed: SealedKeyValue): string {
    return this.#for(type).decrypt(sealed);
  }

  #for(type: PixKeyType): AesGcmPiiProtector {
    let protector = this.#byType.get(type);
    if (protector === undefined) {
      protector = new AesGcmPiiProtector(this.#keys, {
        associatedData: 'payments.pix_keys.value',
        indexPrefix: `pix-key:${type}`,
      });
      this.#byType.set(type, protector);
    }
    return protector;
  }
}
