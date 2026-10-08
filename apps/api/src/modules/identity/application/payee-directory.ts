import type { Transaction } from '../../../shared/application/ports.ts';
import type { IdentityRepositoriesFactory, Payee } from './ports.ts';

/**
 * Identity's answer to the port Payments defines (context map: "lê nome do
 * titular", D6), in the caller's transaction: the name and the masked CPF only.
 */
export class PayeeDirectory {
  readonly #repositories: IdentityRepositoriesFactory;

  constructor(repositories: IdentityRepositoriesFactory) {
    this.#repositories = repositories;
  }

  payeeOf(tx: Transaction, userId: string): Promise<Payee | null> {
    return this.#repositories.for(tx).users.findPayee(userId);
  }
}
