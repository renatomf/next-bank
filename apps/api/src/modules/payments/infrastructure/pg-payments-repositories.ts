import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type {
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeysRepository,
  ProtectedKeyValue,
} from '../application/ports.ts';
import type { PixKeyState } from '../domain/pix-key.ts';

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
}

/** The payments repositories on the connection of the shared transaction. */
export class PgPaymentsRepositories implements PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories {
    return { pixKeys: new PgPixKeysRepository(pgClientOf(tx)) };
  }
}
