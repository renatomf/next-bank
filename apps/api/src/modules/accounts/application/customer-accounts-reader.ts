import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { BRANCH, type AccountStatus } from '../domain/account.ts';
import type {
  AccountsRepositoriesFactory,
  LedgerPort,
  StatementPage,
  StatementPosition,
} from './ports.ts';
import { NO_STATEMENT_FILTER } from './ports.ts';

/** A customer's account as the staff sees it: no ids of the ledger. */
export interface CustomerAccount {
  holderId: string;
  branch: string;
  number: string;
  status: AccountStatus;
  openedAt: Date;
}

/**
 * Accounts' answer to the port Operations defines (v1.3.0 plan, task 3), in
 * the caller's transaction: the accounts, balance and statement of a
 * customer, found by the holder. Operations decides who may read them.
 */
export class CustomerAccountsReader {
  readonly #repositories: AccountsRepositoriesFactory;
  readonly #ledger: LedgerPort;

  constructor(repositories: AccountsRepositoriesFactory, ledger: LedgerPort) {
    this.#repositories = repositories;
    this.#ledger = ledger;
  }

  async ofHolders(tx: Transaction, holderIds: string[]): Promise<CustomerAccount[]> {
    const accounts = await this.#repositories.for(tx).accounts.findByHolders(holderIds);
    return accounts.map((account) => ({
      holderId: account.holderUserId,
      branch: account.branch,
      number: account.number,
      status: account.status,
      openedAt: account.openedAt,
    }));
  }

  async holderOf(tx: Transaction, number: string): Promise<string | null> {
    const account = await this.#repositories.for(tx).accounts.findByNumber(BRANCH, number);
    return account?.holderUserId ?? null;
  }

  async holderOfAccount(tx: Transaction, accountId: string): Promise<string | null> {
    const account = await this.#repositories.for(tx).accounts.findById(accountId);
    return account?.holderUserId ?? null;
  }

  async holdersOfAccounts(tx: Transaction, accountIds: string[]): Promise<Map<string, string>> {
    if (accountIds.length === 0) return new Map();
    const accounts = await this.#repositories.for(tx).accounts.findByIds(accountIds);
    return new Map(accounts.map((account) => [account.id, account.holderUserId]));
  }

  async balanceOf(tx: Transaction, holderId: string): Promise<Money> {
    const accountId = await this.#accountOf(tx, holderId);
    const balance = await this.#ledger.availableBalance(tx, accountId);
    if (!balance) throw new Error(`Account ${accountId} has no ledger account`);
    return balance;
  }

  async statementOf(
    tx: Transaction,
    holderId: string,
    after: StatementPosition | null,
  ): Promise<StatementPage> {
    const accountId = await this.#accountOf(tx, holderId);
    return this.#ledger.statement(tx, accountId, after, NO_STATEMENT_FILTER);
  }

  /** Every customer has an account, opened with the registration. */
  async #accountOf(tx: Transaction, holderId: string): Promise<string> {
    const account = await this.#repositories.for(tx).accounts.findByHolder(holderId);
    if (!account) throw new Error(`Customer ${holderId} has no account`);
    return account.id;
  }
}
