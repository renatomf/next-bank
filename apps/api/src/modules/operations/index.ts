// Public API of the operations context: the bank seen from inside, by the
// staff (v1.3.0). Other modules use only what is exported here (ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { GetCustomer } from './application/get-customer.ts';
import { GetCustomerStatement } from './application/get-customer-statement.ts';
import type { CustomerAccountsPort, CustomersPort } from './application/ports.ts';
import { SearchCustomers } from './application/search-customers.ts';
import { PgAuditTrailFactory } from './infrastructure/pg-audit-trail-factory.ts';

export { customerRoutes } from './http/customer-routes.ts';

export interface OperationsModule {
  searchCustomers: SearchCustomers;
  getCustomer: GetCustomer;
  getCustomerStatement: GetCustomerStatement;
}

/** Builds the operations context; it reaches Identity and Accounts only through its ports. */
export function createOperationsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  customers: CustomersPort;
  accounts: CustomerAccountsPort;
}): OperationsModule {
  const deps = { ...settings, audit: new PgAuditTrailFactory() };
  return {
    searchCustomers: new SearchCustomers(deps),
    getCustomer: new GetCustomer(deps),
    getCustomerStatement: new GetCustomerStatement(deps),
  };
}
