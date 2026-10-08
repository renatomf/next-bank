import pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  ClaimResult,
  IdempotencyClaim,
  IdempotencyRepository,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeysRepository,
  PixTransfersRepository,
  ProtectedKeyValue,
  StoredPixKey,
  StoredResponse,
} from '../application/ports.ts';
import { RequestInProgress } from '../domain/errors.ts';
import type { PixKeyState, PixKeyType } from '../domain/pix-key.ts';
import type { PixTransferState } from '../domain/pix-transfer.ts';

export class PgPixKeysRepository implements PixKeysRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  /** The value goes only encrypted; pix_keys_type_value_hmac_key keeps one account per key. */
  async insert(key: PixKeyState, value: ProtectedKeyValue): Promise<void> {
    await this.#client.query(
      `INSERT INTO payments.pix_keys
         (id, account_id, type, value_ciphertext, value_hmac, value_masked, key_version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        key.id,
        key.accountId,
        key.type,
        value.ciphertext,
        value.blindIndex,
        key.masked,
        value.keyVersion,
        key.createdAt,
      ],
    );
  }

  /** Served by the pix_keys_type_value_hmac_key unique index. */
  async findByIndex(type: PixKeyType, blindIndex: Uint8Array): Promise<StoredPixKey | null> {
    const { rows } = await this.#client.query<{ account_id: string; value_masked: string }>(
      `SELECT account_id, value_masked FROM payments.pix_keys
       WHERE type = $1 AND value_hmac = $2`,
      [type, blindIndex],
    );
    const row = rows[0];
    return row ? { accountId: row.account_id, masked: row.value_masked } : null;
  }
}

export class PgPixTransfersRepository implements PixTransfersRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(transfer: PixTransferState): Promise<void> {
    await this.#client.query(
      `INSERT INTO payments.pix_transfers
         (id, end_to_end_id, payer_account_id, payee_account_id, payee_key_type, payee_key_masked,
          payee_name, payee_document_masked, amount, currency, description, status, failure_reason,
          version, created_at, expires_at, authorized_at, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        transfer.id,
        transfer.endToEndId,
        transfer.payerAccountId,
        transfer.payee.accountId,
        transfer.payee.keyType,
        transfer.payee.keyMasked,
        transfer.payee.name,
        transfer.payee.documentMasked,
        transfer.amount.cents.toString(),
        transfer.amount.currency,
        transfer.description,
        transfer.status,
        transfer.failureReason,
        transfer.version,
        transfer.createdAt,
        transfer.expiresAt,
        transfer.authorizedAt,
        transfer.completedAt,
        transfer.updatedAt,
      ],
    );
  }
}

/** Waiting for a lock longer than the role's lock_timeout (API-12). */
const LOCK_NOT_AVAILABLE = '55P03';

export class PgIdempotencyRepository implements IdempotencyRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async claim(claim: IdempotencyClaim): Promise<ClaimResult> {
    // A key past its 24 hours is free again (ADR 0007).
    await this.#client.query(
      `DELETE FROM payments.idempotency_records
       WHERE user_id = $1 AND key = $2 AND expires_at <= $3`,
      [claim.userId, claim.key, claim.createdAt],
    );
    let inserted: number | null;
    try {
      // A concurrent insert of the same key waits here until the first commits.
      ({ rowCount: inserted } = await this.#client.query(
        `INSERT INTO payments.idempotency_records
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
       FROM payments.idempotency_records WHERE user_id = $1 AND key = $2`,
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
      `UPDATE payments.idempotency_records
       SET status = 'COMPLETED', response_status = $3, response_body = $4
       WHERE user_id = $1 AND key = $2`,
      [userId, key, response.status, JSON.stringify(response.body)],
    );
  }
}

/** The payments repositories and the audit trail on the connection of the shared transaction. */
export class PgPaymentsRepositories implements PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories {
    const client = pgClientOf(tx);
    return {
      pixKeys: new PgPixKeysRepository(client),
      pixTransfers: new PgPixTransfersRepository(client),
      idempotency: new PgIdempotencyRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
