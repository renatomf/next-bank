import { createHmac } from 'node:crypto';
import type { PiiKeys } from '../../../shared/infrastructure/aes-gcm-pii-protector.ts';
import type { RequestFingerprint } from '../application/ports.ts';

/**
 * HMAC-SHA256 of a request, with its own prefix under the blind index key. A
 * plain SHA-256 of a Pix request (payee CPF, amount) could be brute-forced from
 * a database dump; keyed, it cannot without the key (week 5 plan, D4).
 */
export class HmacRequestFingerprint implements RequestFingerprint {
  readonly #key: Uint8Array;

  constructor(keys: PiiKeys) {
    this.#key = keys.hmacKey;
  }

  of(operation: string, payload: unknown): Uint8Array {
    return createHmac('sha256', this.#key)
      .update(`idempotency:${operation}:${JSON.stringify(payload)}`)
      .digest();
  }
}
