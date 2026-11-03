import type { Transaction } from '../../../shared/application/ports.ts';
import type { StaffRepositoriesFactory } from './ports.ts';

/** Staff's answer to the port Operations defines: who asked, who decided, who acted. */
export class StaffDirectory {
  readonly #repositories: StaffRepositoriesFactory;

  constructor(repositories: StaffRepositoriesFactory) {
    this.#repositories = repositories;
  }

  namesOf(tx: Transaction, ids: string[]): Promise<Map<string, string>> {
    return this.#repositories.for(tx).members.namesOf(ids);
  }

  /** A member's name and whether it is the public demo's (v1.3.0, task 8). */
  async memberOf(tx: Transaction, id: string): Promise<{ name: string; isDemo: boolean } | null> {
    const member = await this.#repositories.for(tx).members.findById(id);
    return member && { name: member.name, isDemo: member.isDemo };
  }
}
