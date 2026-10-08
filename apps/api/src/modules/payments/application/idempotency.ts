import { IdempotencyKeyReused, RequestInProgress } from '../domain/errors.ts';
import type {
  IdempotencyClaim,
  IdempotencyRepository,
  RequestFingerprint,
  StoredResponse,
} from './ports.ts';

const VALIDITY_MS = 24 * 60 * 60_000;

export interface IdempotentRequest {
  userId: string;
  key: string;
  operation: IdempotencyClaim['operation'];
  /** What identifies the request; never secrets such as the PIN (D4). */
  payload: unknown;
  now: Date;
}

/**
 * Makes a financial command safe to repeat (ADR 0007): the same key and
 * request get the first answer back; the same key with another request is a
 * client bug. Runs inside the command's transaction, so a technical failure
 * releases the key together with everything else.
 */
export class Idempotency {
  readonly #fingerprint: RequestFingerprint;

  constructor(fingerprint: RequestFingerprint) {
    this.#fingerprint = fingerprint;
  }

  async run(
    records: IdempotencyRepository,
    request: IdempotentRequest,
    work: () => Promise<StoredResponse>,
  ): Promise<StoredResponse> {
    const requestHash = this.#fingerprint.of(request.operation, request.payload);
    const claim = await records.claim({
      userId: request.userId,
      key: request.key,
      operation: request.operation,
      requestHash,
      createdAt: request.now,
      expiresAt: new Date(request.now.getTime() + VALIDITY_MS),
    });
    if (!claim.claimed) {
      if (claim.operation !== request.operation || !sameBytes(claim.requestHash, requestHash)) {
        throw new IdempotencyKeyReused();
      }
      if (claim.response === null) throw new RequestInProgress();
      return claim.response;
    }

    const response = await work();
    await records.complete(request.userId, request.key, response);
    return response;
  }
}

// Both hashes are keyed and stored by the server: no secret to time, plain comparison.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}
