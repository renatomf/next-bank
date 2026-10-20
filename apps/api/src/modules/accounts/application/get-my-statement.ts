import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import type {
  AccountsRepositoriesFactory,
  LedgerPort,
  StatementFilter,
  StatementPage,
  StatementPosition,
} from './ports.ts';
import { NO_STATEMENT_FILTER } from './ports.ts';

/**
 * The caller's own statement (domain-model.md 8.1; week 6 plan, D2). The
 * account comes from the authenticated user, never from the request (READ-01);
 * the ledger is read through the port Accounts defines, as for the balance.
 */
export class GetMyStatement {
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

  execute(
    userId: string,
    after: StatementPosition | null,
    filter: StatementFilter = NO_STATEMENT_FILTER,
  ): Promise<StatementPage> {
    return this.#unitOfWork.run(async (tx) => {
      const account = await this.#repositories.for(tx).accounts.findByHolder(userId);
      if (!account) throw new NotFound('Account');
      return this.#ledger.statement(tx, account.id, after, filter);
    });
  }
}
