import { NotFound } from '../../../shared/domain/not-found.ts';
import { type CustomerReadsDependencies, recordAccess, scopeOf } from './customer-reads.ts';
import type { StaffReader, StatementPage, StatementPosition } from './ports.ts';

/**
 * A customer's statement for the staff (v1.3.0 plan, task 3; STF-07): the
 * same pages the customer reads. Every page read writes its event.
 */
export class GetCustomerStatement {
  readonly #deps: CustomerReadsDependencies;

  constructor(deps: CustomerReadsDependencies) {
    this.#deps = deps;
  }

  execute(
    reader: StaffReader,
    customerId: string,
    after: StatementPosition | null,
  ): Promise<StatementPage> {
    return this.#deps.unitOfWork.run(async (tx) => {
      const customer = await this.#deps.customers.find(tx, customerId, scopeOf(reader));
      if (!customer) throw new NotFound('Customer');
      const page = await this.#deps.accounts.statementOf(tx, customer.id, after);
      await recordAccess(this.#deps, tx, reader, customer.id, 'STATEMENT');
      return page;
    });
  }
}
