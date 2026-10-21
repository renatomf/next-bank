import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import type { AccountsPort, TopUpsRepositoriesFactory } from './ports.ts';
import { type TopUpView, viewOf } from './top-up-view.ts';

export interface GetTopUpDependencies {
  unitOfWork: UnitOfWork;
  repositories: TopUpsRepositoriesFactory;
  accounts: AccountsPort;
}

/**
 * The receipt of a top-up, only to its owner: another customer's top-up is
 * answered as not found, the same as one that does not exist (READ-01).
 */
export class GetTopUp {
  readonly #deps: GetTopUpDependencies;

  constructor(deps: GetTopUpDependencies) {
    this.#deps = deps;
  }

  execute(userId: string, topUpId: string): Promise<TopUpView> {
    return this.#deps.unitOfWork.run(async (tx) => {
      const account = await this.#deps.accounts.findByHolder(tx, userId);
      const state =
        account && (await this.#deps.repositories.for(tx).topUps.findForOwner(topUpId, account.id));
      if (!state) throw new NotFound('Top-up');
      return viewOf(state);
    });
  }
}
