import pg from 'pg';
import type {
  ClaimResult,
  IdempotencyClaim,
  IdempotencyRepository,
  StoredResponse,
} from '../application/idempotency.ts';
import { RequestInProgress } from '../domain/idempotency-errors.ts';

/** Waiting for a lock longer than the role's lock_timeout (API-12). */
const LOCK_NOT_AVAILABLE = '55P03';

/** The idempotency records every module's commands share (ADR 0015). */
export class PgIdempotencyRepository implements IdempotencyRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async claim(claim: IdempotencyClaim): Promise<ClaimResult> {
    // A key past its 24 hours is free again (ADR 0007).
    await this.#client.query(
      `DELETE FROM platform.idempotency_records
       WHERE user_id = $1 AND key = $2 AND expires_at <= $3`,
      [claim.userId, claim.key, claim.createdAt],
    );
    let inserted: number | null;
    try {
      // A concurrent insert of the same key waits here until the first commits.
      ({ rowCount: inserted } = await this.#client.query(
        `INSERT INTO platform.idempotency_records
           (user_id, key, operation, request_hash, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, $6)
         ON CONFLICT (user_id, key) DO NOTHING`,
        [
          claim.userId,
          claim.key,
          claim.operation,
          claim.requestHash,
          claim.createdAt,
          claim.expiresAt,
        ],
      ));
    } catch (error) {
      if (error instanceof pg.DatabaseError && error.code === LOCK_NOT_AVAILABLE) {
        throw new RequestInProgress();
      }
      throw error;
    }
    if (inserted === 1) return { claimed: true };

    const { rows } = await this.#client.query<{
      operation: string;
      request_hash: Buffer;
      response_status: number | null;
      response_body: unknown;
    }>(
      `SELECT operation, request_hash, response_status, response_body
       FROM platform.idempotency_records WHERE user_id = $1 AND key = $2`,
      [claim.userId, claim.key],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('Idempotency record vanished after a conflict');
    return {
      claimed: false,
      operation: row.operation,
      requestHash: row.request_hash,
      response:
        row.response_status === null
          ? null
          : { status: row.response_status, body: row.response_body },
    };
  }

  async complete(userId: string, key: string, response: StoredResponse): Promise<void> {
    await this.#client.query(
      `UPDATE platform.idempotency_records
       SET status = 'COMPLETED', response_status = $3, response_body = $4
       WHERE user_id = $1 AND key = $2`,
      [userId, key, response.status, JSON.stringify(response.body)],
    );
  }
}
