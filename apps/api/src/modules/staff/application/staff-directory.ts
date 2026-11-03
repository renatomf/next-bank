import type { Transaction } from '../../../shared/application/ports.ts';
import type { StaffRepositoriesFactory } from './ports.ts';

/** Staff's answer to the port Operations defines: who asked and who decided, by name. */
export class StaffDirectory {
  readonly #repositories: StaffRepositoriesFactory;

  constructor(repositories: StaffRepositoriesFactory) {
    this.#repositories = repositories;
  }

  namesOf(tx: Transaction, ids: string[]): Promise<Map<string, string>> {
    return this.#repositories.for(tx).members.namesOf(ids);
  }
}
