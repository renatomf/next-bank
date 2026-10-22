import type { Transaction } from '../../../../src/shared/application/ports.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import type {
  LedgerRepository,
  LedgerRepositoryFactory,
  StatementRow,
} from '../../../../src/modules/ledger/application/ports.ts';
import type { JournalEntryState } from '../../../../src/modules/ledger/domain/journal-entry.ts';
import type { LedgerAccountState } from '../../../../src/modules/ledger/domain/ledger-account.ts';

export const FUNDING_ID = 'ledger-funding';

/** The operators' system accounts (v1.1.0 plan, task 5), one per operator. */
export const TOP_UP_OPERATOR_IDS = ['onda-movel', 'pulso-celular', 'rede-nova'] as const;
export const topUpLedgerIdOf = (operatorId: string): string => `ledger-top-up-${operatorId}`;
/** Where an external Pix waits for the SPI (v1.2.0 plan, task 3). */
export const PIX_CLEARING_ID = 'ledger-pix-clearing';

/** The transaction the use cases receive; the fake ledger ignores it. */
export const tx: Transaction = { kind: 'transaction' };

/**
 * In-memory ledger. Records the ids each posting asked to lock; the order of
 * the locks is the SQL's job, proven against Postgres (T-DB-09).
 */
export class InMemoryLedger implements LedgerRepositoryFactory {
  accounts = new Map<string, LedgerAccountState>();
  entries: JournalEntryState[] = [];
  locks: string[][] = [];

  constructor() {
    this.accounts.set(FUNDING_ID, {
      id: FUNDING_ID,
      code: 'system:funding',
      kind: 'SYSTEM',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
    });
    this.accounts.set(PIX_CLEARING_ID, {
      id: PIX_CLEARING_ID,
      code: 'system:pix_clearing',
      kind: 'SYSTEM',
      postedBalance: Money.zero(),
      availableBalance: Money.zero(),
      version: 0,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
    });
    for (const operatorId of TOP_UP_OPERATOR_IDS) {
      this.accounts.set(topUpLedgerIdOf(operatorId), {
        id: topUpLedgerIdOf(operatorId),
        code: `system:top-up-${operatorId}`,
        kind: 'SYSTEM',
        postedBalance: Money.zero(),
        availableBalance: Money.zero(),
        version: 0,
        createdAt: new Date('2026-10-07T00:00:00.000Z'),
      });
    }
  }

  /** A customer ledger account with [cents] already on it. */
  addCustomer(id: string, accountId: string, cents: bigint): void {
    this.accounts.set(id, {
      id,
      code: `customer:${accountId}`,
      kind: 'CUSTOMER',
      postedBalance: Money.of(cents),
      availableBalance: Money.of(cents),
      version: 0,
      createdAt: new Date('2026-10-07T00:00:00.000Z'),
    });
  }

  balanceOf(id: string): bigint | undefined {
    return this.accounts.get(id)?.availableBalance.cents;
  }

  for(): LedgerRepository {
    return {
      findByCode: (code) =>
        Promise.resolve([...this.accounts.values()].find((a) => a.code === code) ?? null),
      lockForPosting: (ids) => {
        const found = ids.flatMap((id) => {
          const account = this.accounts.get(id);
          return account ? [{ ...account }] : [];
        });
        this.locks.push([...ids]);
        return Promise.resolve(found);
      },
      insertAccount: (account) => {
        this.accounts.set(account.id, { ...account });
        return Promise.resolve();
      },
      insertEntry: (entry) => {
        this.entries.push(entry);
        return Promise.resolve();
      },
      updateBalance: (account) => {
        this.accounts.set(account.id, { ...account });
        return Promise.resolve();
      },
      // Newest first, by (created_at, id), as the SQL of database.md section 8.
      // The filter is the database's work: the integration tests cover it.
      statementPage: (ledgerAccountId, after, limit) => {
        const rows: StatementRow[] = this.entries.flatMap((entry) =>
          entry.postings
            .filter((posting) => posting.ledgerAccountId === ledgerAccountId)
            .map((posting) => ({
              postingId: posting.id,
              position: entry.createdAt.toISOString(),
              occurredAt: entry.createdAt,
              direction: posting.direction,
              amount: posting.amount,
              counterpartyName: posting.counterpartyName,
              counterpartyDocumentMasked: posting.counterpartyDocumentMasked,
              entryKind: entry.kind,
              referenceId: entry.referenceId,
            })),
        );
        const sorted = rows.sort((a, b) =>
          a.position === b.position
            ? b.postingId.localeCompare(a.postingId)
            : b.position.localeCompare(a.position),
        );
        const start = after
          ? sorted.findIndex(
              (row) =>
                row.position < after.createdAt ||
                (row.position === after.createdAt && row.postingId < after.postingId),
            )
          : 0;
        return Promise.resolve(start < 0 ? [] : sorted.slice(start, start + limit));
      },
    };
  }
}
