import pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgIdempotencyRepository } from '../../../shared/infrastructure/pg-idempotency-repository.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  InboxRepository,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeysRepository,
  PixTransfersRepository,
  ProtectedKeyValue,
  SealedKeyValue,
  StoredPixKey,
  StoredRandomKey,
} from '../application/ports.ts';
import type { PixKeyState, PixKeyType } from '../domain/pix-key.ts';
import type {
  PixFailureReason,
  PixTransferState,
  PixTransferStatus,
} from '../domain/pix-transfer.ts';
import { Money } from '../../../shared/domain/money.ts';
import { PgPixSchedulesRepository } from './pg-pix-schedules-repository.ts';

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

  /**
   * Only pix_keys_one_random_per_account is the arbiter: a clash on the value
   * index (the same UUID in another account) still fails, and never reads as
   * "the account already had one".
   */
  async insertRandomIfAbsent(key: PixKeyState, value: ProtectedKeyValue): Promise<boolean> {
    const { rowCount } = await this.#client.query(
      `INSERT INTO payments.pix_keys
         (id, account_id, type, value_ciphertext, value_hmac, value_masked, key_version, created_at)
       VALUES ($1, $2, 'RANDOM', $3, $4, $5, $6, $7)
       ON CONFLICT (account_id) WHERE type = 'RANDOM' DO NOTHING`,
      [
        key.id,
        key.accountId,
        value.ciphertext,
        value.blindIndex,
        key.masked,
        value.keyVersion,
        key.createdAt,
      ],
    );
    return rowCount === 1;
  }

  /** Served by the pix_keys_one_random_per_account partial unique index. */
  async findRandomOf(accountId: string): Promise<StoredRandomKey | null> {
    const { rows } = await this.#client.query<{
      value_ciphertext: Uint8Array;
      key_version: number;
      value_masked: string;
    }>(
      `SELECT value_ciphertext, key_version, value_masked FROM payments.pix_keys
       WHERE account_id = $1 AND type = 'RANDOM'`,
      [accountId],
    );
    const row = rows[0];
    return row
      ? { ciphertext: row.value_ciphertext, keyVersion: row.key_version, masked: row.value_masked }
      : null;
  }
}

export class PgPixTransfersRepository implements PixTransfersRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(transfer: PixTransferState, payeeKey?: SealedKeyValue): Promise<void> {
    await this.#client.query(
      `INSERT INTO payments.pix_transfers
         (id, end_to_end_id, payer_account_id, payee_account_id, payee_key_type, payee_key_masked,
          payee_name, payee_document_masked, amount, currency, description, status, failure_reason,
          version, created_at, expires_at, authorized_at, completed_at, updated_at,
          payee_ispb, payee_bank_name, payee_key_ciphertext, payee_key_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
               $20, $21, $22, $23)`,
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
        transfer.payee.bank?.ispb ?? null,
        transfer.payee.bank?.name ?? null,
        payeeKey?.ciphertext ?? null,
        payeeKey?.keyVersion ?? null,
      ],
    );
  }

  /** Served by the primary key; the payer filter makes another customer's Pix invisible. */
  async findForPayer(id: string, payerAccountId: string): Promise<PixTransferState | null> {
    const { rows } = await this.#client.query<TransferRow>(
      `${SELECT_TRANSFER} WHERE id = $1 AND payer_account_id = $2`,
      [id, payerAccountId],
    );
    return stateOf(rows[0]);
  }

  async lockForPayer(id: string, payerAccountId: string): Promise<PixTransferState | null> {
    const { rows } = await this.#client.query<TransferRow>(
      `${SELECT_TRANSFER} WHERE id = $1 AND payer_account_id = $2 FOR UPDATE`,
      [id, payerAccountId],
    );
    return stateOf(rows[0]);
  }

  /** Served by the pix_transfers_external_processing_idx partial index. */
  async findWaitingForSpi(
    authorizedBefore: Date,
    limit: number,
  ): Promise<{ id: string; endToEndId: string }[]> {
    const { rows } = await this.#client.query<{ id: string; end_to_end_id: string }>(
      `SELECT id, end_to_end_id FROM payments.pix_transfers
       WHERE status = 'PROCESSING' AND payee_ispb IS NOT NULL AND authorized_at <= $1
       ORDER BY authorized_at
       LIMIT $2`,
      [authorizedBefore, limit],
    );
    return rows.map((row) => ({ id: row.id, endToEndId: row.end_to_end_id }));
  }

  /** Served by the pix_transfers_end_to_end_id_key unique index. */
  async lockByEndToEndId(endToEndId: string): Promise<PixTransferState | null> {
    const { rows } = await this.#client.query<TransferRow>(
      `${SELECT_TRANSFER} WHERE end_to_end_id = $1 FOR UPDATE`,
      [endToEndId],
    );
    return stateOf(rows[0]);
  }

  /** Served by the primary key; only a Pix to another bank has a sealed key. */
  async findExternalForSending(
    id: string,
  ): Promise<{ transfer: PixTransferState; payeeKey: SealedKeyValue } | null> {
    const { rows } = await this.#client.query<
      TransferRow & { payee_key_ciphertext: Uint8Array; payee_key_version: number }
    >(
      `SELECT ${TRANSFER_COLUMNS}, payee_key_ciphertext, payee_key_version
       FROM payments.pix_transfers
       WHERE id = $1 AND payee_key_ciphertext IS NOT NULL`,
      [id],
    );
    const row = rows[0];
    const transfer = stateOf(row);
    return row && transfer
      ? {
          transfer,
          payeeKey: { ciphertext: row.payee_key_ciphertext, keyVersion: row.payee_key_version },
        }
      : null;
  }

  /** Only the state moves; what was asked never changes (database.md 6, column grants). */
  async update(transfer: PixTransferState): Promise<void> {
    await this.#client.query(
      `UPDATE payments.pix_transfers
       SET status = $2, failure_reason = $3, end_to_end_id = $4, authorized_at = $5,
           completed_at = $6, version = $7, updated_at = $8
       WHERE id = $1`,
      [
        transfer.id,
        transfer.status,
        transfer.failureReason,
        transfer.endToEndId,
        transfer.authorizedAt,
        transfer.completedAt,
        transfer.version,
        transfer.updatedAt,
      ],
    );
  }
}

const TRANSFER_COLUMNS = `id, end_to_end_id, payer_account_id, payee_account_id, payee_key_type,
    payee_key_masked, payee_name, payee_document_masked, amount, currency, description, status,
    failure_reason, version, created_at, expires_at, authorized_at, completed_at, updated_at,
    payee_ispb, payee_bank_name`;

const SELECT_TRANSFER = `SELECT ${TRANSFER_COLUMNS} FROM payments.pix_transfers`;

interface TransferRow {
  id: string;
  end_to_end_id: string | null;
  payer_account_id: string;
  payee_account_id: string | null;
  payee_key_type: PixKeyType;
  payee_key_masked: string;
  payee_name: string;
  payee_document_masked: string;
  /** bigint arrives as a string: never through a JavaScript number (D1). */
  amount: string;
  currency: 'BRL';
  description: string | null;
  status: PixTransferStatus;
  failure_reason: PixFailureReason | null;
  version: string;
  created_at: Date;
  expires_at: Date;
  authorized_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
  payee_ispb: string | null;
  payee_bank_name: string | null;
}

function stateOf(row: TransferRow | undefined): PixTransferState | null {
  return row
    ? {
        id: row.id,
        endToEndId: row.end_to_end_id,
        payerAccountId: row.payer_account_id,
        payee: {
          accountId: row.payee_account_id,
          name: row.payee_name,
          documentMasked: row.payee_document_masked,
          keyType: row.payee_key_type,
          keyMasked: row.payee_key_masked,
          // The CHECK keeps the bank's two columns null or set together (P3).
          ...(row.payee_ispb !== null && row.payee_bank_name !== null
            ? { bank: { ispb: row.payee_ispb, name: row.payee_bank_name } }
            : {}),
        },
        amount: Money.of(BigInt(row.amount), row.currency),
        description: row.description,
        status: row.status,
        failureReason: row.failure_reason,
        version: Number(row.version),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        authorizedAt: row.authorized_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at,
      }
    : null;
}

/** The inbox (ADR 0016): the event id is the primary key, so a repeat inserts nothing. */
export class PgInboxRepository implements InboxRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async record(event: {
    eventId: string;
    source: 'spi';
    outcome: 'APPLIED' | 'IGNORED';
    receivedAt: Date;
  }): Promise<boolean> {
    const { rowCount } = await this.#client.query(
      `INSERT INTO platform.inbox_events (event_id, source, outcome, received_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.source, event.outcome, event.receivedAt],
    );
    return rowCount === 1;
  }
}

/** The payments repositories and the audit trail on the connection of the shared transaction. */
export class PgPaymentsRepositories implements PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories {
    const client = pgClientOf(tx);
    return {
      pixKeys: new PgPixKeysRepository(client),
      pixTransfers: new PgPixTransfersRepository(client),
      pixSchedules: new PgPixSchedulesRepository(client),
      idempotency: new PgIdempotencyRepository(client),
      inbox: new PgInboxRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
