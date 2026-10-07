import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type { LedgerRepository, LedgerRepositoryFactory } from '../application/ports.ts';
import type { JournalEntryState } from '../domain/journal-entry.ts';
import type { Direction, LedgerAccountKind, LedgerAccountState } from '../domain/ledger-account.ts';

interface LedgerAccountRow {
  id: string;
  code: string;
  kind: LedgerAccountKind;
  // int8 arrives as text: read as bigint here, never as a JavaScript number (D1).
  posted_balance: string;
  available_balance: string;
  version: string;
  created_at: Date;
}

const ACCOUNT_COLUMNS = 'id, code, kind, posted_balance, available_balance, version, created_at';

const DIRECTION_CODE: Record<Direction, 'D' | 'C'> = { DEBIT: 'D', CREDIT: 'C' };

export class PgLedgerRepository implements LedgerRepository {
  /** Served by the ledger_accounts_code_key unique index. */
  static readonly FIND_BY_CODE_SQL = `SELECT ${ACCOUNT_COLUMNS}
    FROM ledger.ledger_accounts WHERE code = $1`;

  /** Customer accounts, locked in id order through the primary key (T-DB-09). */
  static readonly LOCK_CUSTOMERS_SQL = `SELECT ${ACCOUNT_COLUMNS}
    FROM ledger.ledger_accounts
    WHERE id = ANY($1::uuid[]) AND kind = 'CUSTOMER'
    ORDER BY id
    FOR UPDATE`;

  /** System accounts: never locked, so they never become a queue. */
  static readonly READ_SYSTEMS_SQL = `SELECT ${ACCOUNT_COLUMNS}
    FROM ledger.ledger_accounts
    WHERE id = ANY($1::uuid[]) AND kind = 'SYSTEM'`;

  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async findByCode(code: string): Promise<LedgerAccountState | null> {
    const { rows } = await this.#client.query<LedgerAccountRow>(
      PgLedgerRepository.FIND_BY_CODE_SQL,
      [code],
    );
    const row = rows[0];
    return row ? toState(row) : null;
  }

  async lockForPosting(ids: readonly string[]): Promise<LedgerAccountState[]> {
    const customers = await this.#client.query<LedgerAccountRow>(
      PgLedgerRepository.LOCK_CUSTOMERS_SQL,
      [ids],
    );
    const systems = await this.#client.query<LedgerAccountRow>(
      PgLedgerRepository.READ_SYSTEMS_SQL,
      [ids],
    );
    return [...customers.rows, ...systems.rows].map(toState);
  }

  async insertAccount(account: LedgerAccountState): Promise<void> {
    await this.#client.query(
      `INSERT INTO ledger.ledger_accounts
         (id, code, kind, currency, posted_balance, available_balance, version, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        account.id,
        account.code,
        account.kind,
        account.postedBalance.currency,
        account.postedBalance.cents.toString(),
        account.availableBalance.cents.toString(),
        account.version,
        account.createdAt,
      ],
    );
  }

  async insertEntry(entry: JournalEntryState): Promise<void> {
    await this.#client.query(
      `INSERT INTO ledger.journal_entries (id, kind, reference_type, reference_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, entry.kind, entry.referenceType, entry.referenceId, entry.createdAt],
    );
    for (const posting of entry.postings) {
      await this.#client.query(
        `INSERT INTO ledger.postings
           (id, journal_entry_id, ledger_account_id, direction, amount, currency,
            counterparty_name, counterparty_document_masked, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          posting.id,
          entry.id,
          posting.ledgerAccountId,
          DIRECTION_CODE[posting.direction],
          posting.amount.cents.toString(),
          posting.amount.currency,
          posting.counterpartyName,
          posting.counterpartyDocumentMasked,
          entry.createdAt,
        ],
      );
    }
  }

  async updateBalance(account: LedgerAccountState): Promise<void> {
    await this.#client.query(
      `UPDATE ledger.ledger_accounts
       SET posted_balance = $2, available_balance = $3, version = $4
       WHERE id = $1`,
      [
        account.id,
        account.postedBalance.cents.toString(),
        account.availableBalance.cents.toString(),
        account.version,
      ],
    );
  }
}

/** The ledger repository on the connection of the shared transaction (ADR 0010). */
export class PgLedgerRepositories implements LedgerRepositoryFactory {
  for(tx: Transaction): LedgerRepository {
    return new PgLedgerRepository(pgClientOf(tx));
  }
}

function toState(row: LedgerAccountRow): LedgerAccountState {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    postedBalance: Money.of(BigInt(row.posted_balance)),
    availableBalance: Money.of(BigInt(row.available_balance)),
    version: Number(row.version),
    createdAt: row.created_at,
  };
}
