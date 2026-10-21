import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import { PgIdempotencyRepository } from '../../../shared/infrastructure/pg-idempotency-repository.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  ProtectedPhone,
  TopUpState,
  TopUpsRepositories,
  TopUpsRepositoriesFactory,
  TopUpsRepository,
} from '../application/ports.ts';

interface TopUpRow {
  id: string;
  account_id: string;
  operator_id: string;
  phone_masked: string;
  /** bigint arrives as a string: never through a JavaScript number (D1). */
  amount: string;
  currency: 'BRL';
  status: 'COMPLETED';
  provider_reference: string;
  created_at: Date;
}

const COLUMNS = `id, account_id, operator_id, phone_masked, amount, currency, status,
  provider_reference, created_at`;

export class PgTopUpsRepository implements TopUpsRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(topUp: TopUpState, phone: ProtectedPhone): Promise<void> {
    await this.#client.query(
      `INSERT INTO top_ups.top_ups
         (id, account_id, operator_id, phone_ciphertext, phone_key_version, phone_masked,
          amount, currency, status, provider_reference, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        topUp.id,
        topUp.accountId,
        topUp.operatorId,
        phone.ciphertext,
        phone.keyVersion,
        topUp.phoneMasked,
        topUp.amount.cents.toString(),
        topUp.amount.currency,
        topUp.status,
        topUp.providerReference,
        topUp.createdAt,
      ],
    );
  }

  /** Served by top_ups_account_id_created_at_idx. */
  async spentSince(accountId: string, since: Date): Promise<Money> {
    const { rows } = await this.#client.query<{ total: string }>(
      `SELECT coalesce(sum(amount), 0)::text AS total FROM top_ups.top_ups
       WHERE account_id = $1 AND created_at >= $2`,
      [accountId, since],
    );
    return Money.of(BigInt(rows[0]?.total ?? '0'));
  }

  /** By primary key and owner together: another customer's top-up is simply not found. */
  async findForOwner(id: string, accountId: string): Promise<TopUpState | null> {
    const { rows } = await this.#client.query<TopUpRow>(
      `SELECT ${COLUMNS} FROM top_ups.top_ups WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
    const row = rows[0];
    return row === undefined ? null : stateOf(row);
  }
}

function stateOf(row: TopUpRow): TopUpState {
  return {
    id: row.id,
    accountId: row.account_id,
    operatorId: row.operator_id,
    phoneMasked: row.phone_masked,
    amount: Money.of(BigInt(row.amount), row.currency),
    status: row.status,
    providerReference: row.provider_reference,
    createdAt: row.created_at,
  };
}

/** The top-up repositories and the audit trail on the connection of the shared transaction. */
export class PgTopUpsRepositories implements TopUpsRepositoriesFactory {
  for(tx: Transaction): TopUpsRepositories {
    const client = pgClientOf(tx);
    return {
      topUps: new PgTopUpsRepository(client),
      idempotency: new PgIdempotencyRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
