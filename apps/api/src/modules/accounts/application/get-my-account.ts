import type { UnitOfWork } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import type { AccountStatus } from '../domain/account.ts';
import type { AccountsRepositoriesFactory, LedgerPort } from './ports.ts';

/** What the customer sees about their account: no ids, no holder. */
export interface MyAccount {
  branch: string;
  number: string;
  status: AccountStatus;
  availableBalance: Money;
}

/**
 * The caller's own current account with its available balance (decision D5).
 * The account is found by the authenticated user, never by an id the client
 * sends (READ-01). Plain reads: nothing waits for a posting in progress.
 */
export class GetMyAccount {
  readonly #unitOfWork: UnitOfWork;
  readonly #repositories: AccountsRepositoriesFactory;
  readonly #ledger: LedgerPort;

  constructor(deps: {
    unitOfWork: UnitOfWork;
    repositories: AccountsRepositoriesFactory;
    ledger: LedgerPort;
  }) {
    this.#unitOfWork = deps.unitOfWork;
    this.#repositories = deps.repositories;
    this.#ledger = deps.ledger;
  }

  execute(userId: string): Promise<MyAccount> {
    return this.#unitOfWork.run(async (tx) => {
      const account = await this.#repositories.for(tx).accounts.findByHolder(userId);
      if (!account) throw new NotFound('Account');

      const availableBalance = await this.#ledger.availableBalance(tx, account.id);
      if (!availableBalance) throw new Error(`Account ${account.id} has no ledger account`);
      return {
        branch: account.branch,
        number: account.number,
        status: account.status,
        availableBalance,
      };
    });
  }
}
