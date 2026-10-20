import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type {
  LedgerRepository,
  LedgerRepositoryFactory,
  StatementFilter,
  StatementPosition,
  StatementRow,
} from '../application/ports.ts';
import type { JournalEntryKind, JournalEntryState } from '../domain/journal-entry.ts';
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

  /**
   * database.md, section 8, served by postings_statement_idx. The position is
   * the time as UTC text with microseconds, so the next page continues exactly
   * where this one ended, even among postings of the same millisecond. The
   * filter (v1.1.0, task 4.1) narrows the same scan: one kind and part of the
   * counterparty's name, the client's text escaped so it is never a wildcard.
   */
  static readonly STATEMENT_SQL = `SELECT p.id, p.direction, p.amount, p.currency,
      p.counterparty_name, p.counterparty_document_masked, p.created_at,
      to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS position,
      je.kind, je.reference_id
    FROM ledger.postings p
    JOIN ledger.journal_entries je ON je.id = p.journal_entry_id
    WHERE p.ledger_account_id = $1
      AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2::timestamptz, $3::uuid))
      AND ($5::text IS NULL
        OR ($5 = 'IN' AND p.direction = 'C')
        OR ($5 = 'OUT' AND p.direction = 'D')
        OR ($5 = 'PIX' AND je.kind <> 'FUNDING')
        OR ($5 = 'RECEIPT' AND je.kind <> 'FUNDING' AND p.direction = 'D'))
      AND ($6::text IS NULL OR p.counterparty_name ILIKE $6 ESCAPE '\\')
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $4`;

  async statementPage(
    ledgerAccountId: string,
    after: StatementPosition | null,
    limit: number,
    filter: StatementFilter,
  ): Promise<StatementRow[]> {
    const { rows } = await this.#client.query<StatementRowRecord>(
      PgLedgerRepository.STATEMENT_SQL,
      [
        ledgerAccountId,
        after?.createdAt ?? null,
        after?.postingId ?? null,
        limit,
        filter.kind,
        filter.search === null ? null : `%${literalLike(filter.search)}%`,
      ],
    );
    return rows.map((row) => ({
      postingId: row.id,
      position: row.position,
      occurredAt: row.created_at,
      direction: row.direction === 'D' ? 'DEBIT' : 'CREDIT',
      amount: Money.of(BigInt(row.amount), row.currency),
      counterpartyName: row.counterparty_name,
      counterpartyDocumentMasked: row.counterparty_document_masked,
      entryKind: row.kind,
      referenceId: row.reference_id,
    }));
  }
}

interface StatementRowRecord {
  id: string;
  direction: 'D' | 'C';
  /** bigint arrives as a string: never through a JavaScript number (D1). */
  amount: string;
  currency: 'BRL';
  counterparty_name: string | null;
  counterparty_document_masked: string | null;
  created_at: Date;
  position: string;
  kind: JournalEntryKind;
  reference_id: string;
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

/** The client's text as plain characters in LIKE: \, % and _ escaped (READ-04). */
function literalLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
