import type { AuditEvent, Transaction } from '../../../../src/shared/application/ports.ts';
import type { Money } from '../../../../src/shared/domain/money.ts';
import type {
  AccountsRepositories,
  AccountsRepositoriesFactory,
  LedgerPort,
} from '../../../../src/modules/accounts/application/ports.ts';
import type { AccountState } from '../../../../src/modules/accounts/domain/account.ts';

/** The transaction the use cases receive; the fakes ignore it. */
export const tx: Transaction = { kind: 'transaction' };

/** In-memory accounts, also a unit of work that runs the work at once. */
export class InMemoryAccounts implements AccountsRepositoriesFactory {
  accounts: AccountState[] = [];
  auditEvents: AuditEvent[] = [];
  nextSequence = 100000;

  run<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return work(tx);
  }

  for(): AccountsRepositories {
    return {
      accounts: {
        nextSequence: () => Promise.resolve(this.nextSequence++),
        insert: (account) => {
          this.accounts.push(account);
          return Promise.resolve();
        },
        findByHolder: (userId) =>
          Promise.resolve(this.accounts.find((a) => a.holderUserId === userId) ?? null),
        findById: (id) => Promise.resolve(this.accounts.find((a) => a.id === id) ?? null),
        lockForShare: (ids) => Promise.resolve(this.accounts.filter((a) => ids.includes(a.id))),
      },
      audit: {
        record: (event) => {
          this.auditEvents.push(event);
          return Promise.resolve();
        },
      },
    };
  }
}

/** The ledger as Accounts sees it: records what it opened, answers balances. */
export class FakeLedger implements LedgerPort {
  opened: { tx: Transaction; accountId: string }[] = [];
  balances = new Map<string, Money>();

  open(transaction: Transaction, accountId: string): Promise<void> {
    this.opened.push({ tx: transaction, accountId });
    return Promise.resolve();
  }

  availableBalance(_transaction: Transaction, accountId: string): Promise<Money | null> {
    return Promise.resolve(this.balances.get(accountId) ?? null);
  }
}
