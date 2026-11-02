import type { Transaction } from '../../../shared/application/ports.ts';
import type { Cpf } from '../../../shared/domain/cpf.ts';
import type { CpfProtector, CustomerRecord, IdentityRepositoriesFactory } from './ports.ts';

/** Which customers a reader may see: the demo staff only the demo ones (B5, STF-11). */
export interface CustomerScope {
  onlyDemo: boolean;
}

/** How the staff looks a customer up: a CPF, an e-mail or the start of a name. */
export type CustomerLookup =
  { by: 'CPF'; cpf: Cpf } | { by: 'EMAIL'; email: string } | { by: 'NAME'; prefix: string };

/**
 * Identity's answer to the port Operations defines (v1.3.0 plan, task 3), in
 * the caller's transaction: the customers the staff may see, the CPF only
 * masked. A CPF is found by its blind index, never decrypted.
 */
export class CustomerDirectory {
  readonly #repositories: IdentityRepositoriesFactory;
  readonly #cpfProtector: CpfProtector;

  constructor(repositories: IdentityRepositoriesFactory, cpfProtector: CpfProtector) {
    this.#repositories = repositories;
    this.#cpfProtector = cpfProtector;
  }

  async find(tx: Transaction, id: string, scope: CustomerScope): Promise<CustomerRecord | null> {
    const [customer] = await this.findMany(tx, [id], scope);
    return customer ?? null;
  }

  findMany(tx: Transaction, ids: string[], scope: CustomerScope): Promise<CustomerRecord[]> {
    return this.#repositories.for(tx).users.findCustomers(ids, scope.onlyDemo);
  }

  async search(
    tx: Transaction,
    lookup: CustomerLookup,
    scope: CustomerScope,
    limit: number,
  ): Promise<CustomerRecord[]> {
    const users = this.#repositories.for(tx).users;
    switch (lookup.by) {
      case 'CPF':
        return listOf(
          await users.findCustomerByCpf(this.#cpfProtector.blindIndex(lookup.cpf), scope.onlyDemo),
        );
      case 'EMAIL':
        return listOf(await users.findCustomerByEmail(lookup.email, scope.onlyDemo));
      case 'NAME':
        return users.searchCustomersByName(lookup.prefix, scope.onlyDemo, limit);
    }
  }
}

function listOf(customer: CustomerRecord | null): CustomerRecord[] {
  return customer ? [customer] : [];
}
