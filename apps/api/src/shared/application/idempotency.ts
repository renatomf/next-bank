import { IdempotencyKeyReused, RequestInProgress } from '../domain/idempotency-errors.ts';

const VALIDITY_MS = 24 * 60 * 60_000;

/** The answer a request produced, kept so a repeated request gets the same one. */
export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyClaim {
  userId: string;
  key: string;
  /** The command, such as "pix.authorize"; the database lists the known ones. */
  operation: string;
  /** Keyed hash of the request; never covers secrets such as the PIN (D4). */
  requestHash: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
}

export type ClaimResult =
  | { claimed: true }
  | {
      claimed: false;
      operation: string;
      requestHash: Uint8Array;
      /** Null while the first request is still running. */
      response: StoredResponse | null;
    };

/** One record per customer and key (ADR 0007, ADR 0015; database.md 5.4). */
export interface IdempotencyRepository {
  /**
   * Claims the key for this request, or returns what the earlier one left. A
   * concurrent request with the same key waits here until the first commits;
   * waiting too long fails with RequestInProgress.
   */
  claim(claim: IdempotencyClaim): Promise<ClaimResult>;
  complete(userId: string, key: string, response: StoredResponse): Promise<void>;
}

/** A keyed hash of a request, so a dump cannot brute-force what it contained. */
export interface RequestFingerprint {
  of(operation: string, payload: unknown): Uint8Array;
}

export interface IdempotentRequest {
  userId: string;
  key: string;
  operation: string;
  /** What identifies the request; never secrets such as the PIN (D4). */
  payload: unknown;
  now: Date;
}

/**
 * Makes a financial command safe to repeat (ADR 0007): the same key and
 * request get the first answer back; the same key with another request is a
 * client bug. Runs inside the command's transaction, so a technical failure
 * releases the key together with everything else. Shared by every module's
 * commands (ADR 0015).
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
