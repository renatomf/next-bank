import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  AccountsRepositories,
  AccountsRepositoriesFactory,
  AccountsRepository,
} from '../application/ports.ts';
import type { AccountState, AccountStatus } from '../domain/account.ts';

interface AccountRow {
  id: string;
  holder_user_id: string;
  branch: string;
  number: string;
  status: AccountStatus;
  opened_at: Date;
  updated_at: Date;
}

export class PgAccountsRepository implements AccountsRepository {
  /** Served by the accounts_holder_user_id_key unique index. */
  static readonly FIND_BY_HOLDER_SQL = `SELECT id, holder_user_id, branch, number, status,
      opened_at, updated_at
    FROM accounts.accounts WHERE holder_user_id = $1`;

  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async nextSequence(): Promise<number> {
    const { rows } = await this.#client.query<{ sequence: number }>(
      "SELECT nextval('accounts.account_number_seq')::int AS sequence",
    );
    const sequence = rows[0]?.sequence;
    if (sequence === undefined) throw new Error('The account number sequence returned nothing');
    return sequence;
  }

  async findByHolder(userId: string): Promise<AccountState | null> {
    const { rows } = await this.#client.query<AccountRow>(PgAccountsRepository.FIND_BY_HOLDER_SQL, [
      userId,
    ]);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          holderUserId: row.holder_user_id,
          branch: row.branch,
          number: row.number,
          status: row.status,
          openedAt: row.opened_at,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async insert(account: AccountState): Promise<void> {
    await this.#client.query(
      `INSERT INTO accounts.accounts
         (id, holder_user_id, branch, number, status, opened_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        account.id,
        account.holderUserId,
        account.branch,
        account.number,
        account.status,
        account.openedAt,
        account.updatedAt,
      ],
    );
  }
}

/** The accounts repository and the audit trail on the connection of the shared transaction. */
export class PgAccountsRepositories implements AccountsRepositoriesFactory {
  for(tx: Transaction): AccountsRepositories {
    const client = pgClientOf(tx);
    return { accounts: new PgAccountsRepository(client), audit: new PgAuditTrail(client) };
  }
}
