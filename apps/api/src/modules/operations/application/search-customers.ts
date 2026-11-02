import type { Transaction } from '../../../shared/application/ports.ts';
import { customerQueryOf } from '../domain/customer-query.ts';
import {
  type CustomerReadsDependencies,
  type CustomerSummary,
  scopeOf,
  summaryOf,
} from './customer-reads.ts';
import type { CustomerRecord, CustomerScope, StaffReader } from './ports.ts';

/** At most this many customers per search: refine it rather than page it. */
const MOST_RESULTS = 20;

export interface CustomerSearch {
  customers: CustomerSummary[];
  /** More customers matched than were answered. */
  truncated: boolean;
}

/**
 * The staff's search (v1.3.0 plan, task 3, C2): a CPF, an e-mail or an
 * account matched exactly, or the start of a name. One event per search,
 * with the kind of term and how many came back, never the term (C3).
 */
export class SearchCustomers {
  readonly #deps: CustomerReadsDependencies;

  constructor(deps: CustomerReadsDependencies) {
    this.#deps = deps;
  }

  async execute(reader: StaffReader, term: string): Promise<CustomerSearch> {
    const query = customerQueryOf(term);
    const scope = scopeOf(reader);
    return this.#deps.unitOfWork.run(async (tx) => {
      const matches =
        query.by === 'ACCOUNT'
          ? await this.#byAccount(tx, query.number, scope)
          : await this.#deps.customers.search(tx, query, scope, MOST_RESULTS + 1);
      const found = matches.slice(0, MOST_RESULTS);
      const accounts = await this.#deps.accounts.ofHolders(
        tx,
        found.map((customer) => customer.id),
      );
      const customers = found.flatMap((customer) => {
        const account = accounts.find((candidate) => candidate.holderId === customer.id);
        return account ? [summaryOf(customer, account)] : [];
      });
      await this.#deps.audit.for(tx).record({
        id: this.#deps.ids.next(),
        occurredAt: this.#deps.clock.now(),
        actorType: 'STAFF',
        actorId: reader.memberId,
        action: 'CUSTOMERS_SEARCHED',
        subjectType: 'STAFF_MEMBER',
        subjectId: reader.memberId,
        requestId: reader.requestId,
        metadata: { by: query.by, results: customers.length },
      });
      return { customers, truncated: matches.length > MOST_RESULTS };
    });
  }

  async #byAccount(
    tx: Transaction,
    number: string,
    scope: CustomerScope,
  ): Promise<CustomerRecord[]> {
    const holderId = await this.#deps.accounts.holderOf(tx, number);
    return holderId === null ? [] : this.#deps.customers.findMany(tx, [holderId], scope);
  }
}
