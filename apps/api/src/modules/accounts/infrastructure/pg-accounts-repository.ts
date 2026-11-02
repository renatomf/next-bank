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

  /** Served by the accounts_holder_user_id_key unique index. */
  static readonly FIND_BY_HOLDERS_SQL = `SELECT id, holder_user_id, branch, number, status,
      opened_at, updated_at
    FROM accounts.accounts WHERE holder_user_id = ANY($1::uuid[])`;

  /** Served by the accounts_branch_number_key unique index. */
  static readonly FIND_BY_NUMBER_SQL = `SELECT id, holder_user_id, branch, number, status,
      opened_at, updated_at
    FROM accounts.accounts WHERE branch = $1 AND number = $2`;

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
    return stateOf(rows[0]);
  }

  /** Served by the primary key. */
  async findById(id: string): Promise<AccountState | null> {
    const { rows } = await this.#client.query<AccountRow>(
      `SELECT id, holder_user_id, branch, number, status, opened_at, updated_at
       FROM accounts.accounts WHERE id = $1`,
      [id],
    );
    return stateOf(rows[0]);
  }

  async findByHolders(userIds: string[]): Promise<AccountState[]> {
    const { rows } = await this.#client.query<AccountRow>(
      PgAccountsRepository.FIND_BY_HOLDERS_SQL,
      [userIds],
    );
    return rows.flatMap((row) => stateOf(row) ?? []);
  }

  async findByNumber(branch: string, number: string): Promise<AccountState | null> {
    const { rows } = await this.#client.query<AccountRow>(PgAccountsRepository.FIND_BY_NUMBER_SQL, [
      branch,
      number,
    ]);
    return stateOf(rows[0]);
  }

  /** Served by the accounts_holder_user_id_key unique index. */
  async lockByHolder(userId: string): Promise<AccountState | null> {
    const { rows } = await this.#client.query<AccountRow>(
      `${PgAccountsRepository.FIND_BY_HOLDER_SQL} FOR UPDATE`,
      [userId],
    );
    return stateOf(rows[0]);
  }

  async updateStatus(account: AccountState): Promise<void> {
    await this.#client.query(
      'UPDATE accounts.accounts SET status = $2, updated_at = $3 WHERE id = $1',
      [account.id, account.status, account.updatedAt],
    );
  }

  /** Served by the primary key; FOR SHARE holds the status until the commit. */
  async lockForShare(ids: string[]): Promise<AccountState[]> {
    const { rows } = await this.#client.query<AccountRow>(
      `SELECT id, holder_user_id, branch, number, status, opened_at, updated_at
       FROM accounts.accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR SHARE`,
      [ids],
    );
    return rows.flatMap((row) => stateOf(row) ?? []);
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

function stateOf(row: AccountRow | undefined): AccountState | null {
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

/** The accounts repository and the audit trail on the connection of the shared transaction. */
export class PgAccountsRepositories implements AccountsRepositoriesFactory {
  for(tx: Transaction): AccountsRepositories {
    const client = pgClientOf(tx);
    return { accounts: new PgAccountsRepository(client), audit: new PgAuditTrail(client) };
  }
}
