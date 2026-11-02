import type { Money } from '../../../shared/domain/money.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import {
  type CustomerReadsDependencies,
  type CustomerSummary,
  recordAccess,
  scopeOf,
  summaryOf,
} from './customer-reads.ts';
import type { StaffReader } from './ports.ts';

/** The card of a customer: the summary, when the account was opened and the balance. */
export interface CustomerCard extends Omit<CustomerSummary, 'account'> {
  account: CustomerSummary['account'] & { openedAt: Date };
  balance: Money;
}

/**
 * A customer's card for the staff (v1.3.0 plan, task 3; STF-07). A customer
 * the reader may not see answers as one that does not exist (STF-11), and
 * only a card that leaves writes its event.
 */
export class GetCustomer {
  readonly #deps: CustomerReadsDependencies;

  constructor(deps: CustomerReadsDependencies) {
    this.#deps = deps;
  }

  execute(reader: StaffReader, customerId: string): Promise<CustomerCard> {
    return this.#deps.unitOfWork.run(async (tx) => {
      const customer = await this.#deps.customers.find(tx, customerId, scopeOf(reader));
      if (!customer) throw new NotFound('Customer');
      const [account] = await this.#deps.accounts.ofHolders(tx, [customer.id]);
      if (!account) throw new Error(`Customer ${customer.id} has no account`);
      const balance = await this.#deps.accounts.balanceOf(tx, customer.id);
      await recordAccess(this.#deps, tx, reader, customer.id, 'CUSTOMER');
      const summary = summaryOf(customer, account);
      return {
        ...summary,
        account: { ...summary.account, openedAt: account.openedAt },
        balance,
      };
    });
  }
}
