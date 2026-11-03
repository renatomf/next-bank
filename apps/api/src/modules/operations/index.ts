// Public API of the operations context: the bank seen from inside, by the
// staff (v1.3.0). Other modules use only what is exported here (ADR 0010).
import type { RequestFingerprint } from '../../shared/application/idempotency.ts';
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { BlockAccount } from './application/block-account.ts';
import { CancelRequest } from './application/cancel-request.ts';
import { DecideRequest } from './application/decide-request.ts';
import {
  ExplainException,
  GetException,
  ListExceptions,
  RequestResolution,
} from './application/exceptions.ts';
import { GetCustomer } from './application/get-customer.ts';
import { GetCustomerStatement } from './application/get-customer-statement.ts';
import { GetRequest, ListRequests } from './application/list-requests.ts';
import type {
  AccountStatusPort,
  CustomerAccessPort,
  CustomerAccountsPort,
  CustomersPort,
  PixReversalsPort,
  PixTransfersPort,
  ReconciliationExceptionsPort,
  StalePixPort,
  StaffNamesPort,
} from './application/ports.ts';
import { RequestReversal } from './application/request-reversal.ts';
import { RequestUnblock } from './application/request-unblock.ts';
import { SearchCustomers } from './application/search-customers.ts';
import { PgAuditTrailFactory } from './infrastructure/pg-audit-trail-factory.ts';
import { PgOperationsRepositories } from './infrastructure/pg-operations-repositories.ts';

export { customerRoutes } from './http/customer-routes.ts';
export { exceptionRoutes } from './http/exception-routes.ts';
export { requestRoutes } from './http/request-routes.ts';

export interface OperationsModule {
  searchCustomers: SearchCustomers;
  getCustomer: GetCustomer;
  getCustomerStatement: GetCustomerStatement;
  blockAccount: BlockAccount;
  requestUnblock: RequestUnblock;
  requestReversal: RequestReversal;
  decideRequest: DecideRequest;
  cancelRequest: CancelRequest;
  listRequests: ListRequests;
  getRequest: GetRequest;
  requestResolution: RequestResolution;
  explainException: ExplainException;
  listExceptions: ListExceptions;
  getException: GetException;
}

/**
 * Builds the operations context; it reaches Identity, Accounts, Staff,
 * Payments, the Ledger and the Reconciliation only through the ports it
 * defines.
 */
export function createOperationsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  customers: CustomersPort;
  accounts: CustomerAccountsPort;
  accountStatus: AccountStatusPort;
  access: CustomerAccessPort;
  staffNames: StaffNamesPort;
  fingerprint: RequestFingerprint;
  transfers: PixTransfersPort;
  reversals: PixReversalsPort;
  exceptions: ReconciliationExceptionsPort;
  stalePix: StalePixPort;
}): OperationsModule {
  const deps = {
    ...settings,
    audit: new PgAuditTrailFactory(),
    repositories: new PgOperationsRepositories(),
  };
  return {
    searchCustomers: new SearchCustomers(deps),
    getCustomer: new GetCustomer(deps),
    getCustomerStatement: new GetCustomerStatement(deps),
    blockAccount: new BlockAccount(deps),
    requestUnblock: new RequestUnblock(deps),
    requestReversal: new RequestReversal(deps),
    decideRequest: new DecideRequest(deps),
    cancelRequest: new CancelRequest(deps),
    listRequests: new ListRequests(deps),
    getRequest: new GetRequest(deps),
    requestResolution: new RequestResolution(deps),
    explainException: new ExplainException(deps),
    listExceptions: new ListExceptions(deps),
    getException: new GetException(deps),
  };
}
