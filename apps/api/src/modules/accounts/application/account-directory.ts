import type { Transaction } from '../../../shared/application/ports.ts';
import type { AccountStatus } from '../domain/account.ts';
import type { AccountsRepositoriesFactory } from './ports.ts';

/** Who holds an account and whether it moves money: what Payments may know. */
export interface AccountSummary {
  id: string;
  holderUserId: string;
  status: AccountStatus;
}

/**
 * Accounts' answer to the port Payments defines (context map: "consulta conta
 * e status"), in the caller's transaction. Never the number or balance.
 */
export class AccountDirectory {
  readonly #repositories: AccountsRepositoriesFactory;

  constructor(repositories: AccountsRepositoriesFactory) {
    this.#repositories = repositories;
  }

  async findById(tx: Transaction, accountId: string): Promise<AccountSummary | null> {
    const account = await this.#repositories.for(tx).accounts.findById(accountId);
    return (
      account && { id: account.id, holderUserId: account.holderUserId, status: account.status }
    );
  }
}
