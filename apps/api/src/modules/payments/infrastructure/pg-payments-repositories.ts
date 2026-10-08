import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type {
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeysRepository,
  ProtectedKeyValue,
  StoredPixKey,
} from '../application/ports.ts';
import type { PixKeyState, PixKeyType } from '../domain/pix-key.ts';

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

/** The payments repositories on the connection of the shared transaction. */
export class PgPaymentsRepositories implements PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories {
    return { pixKeys: new PgPixKeysRepository(pgClientOf(tx)) };
  }
}
