import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { maskEmail } from '../domain/mask-email.ts';
import type {
  AuditTrailFactory,
  CustomerAccount,
  CustomerAccountsPort,
  CustomerRecord,
  CustomerScope,
  CustomersPort,
  StaffReader,
} from './ports.ts';

/** What every read of customers needs: the two contexts, the trail and the time. */
export interface CustomerReadsDependencies {
  unitOfWork: UnitOfWork;
  customers: CustomersPort;
  accounts: CustomerAccountsPort;
  audit: AuditTrailFactory;
  clock: Clock;
  ids: IdGenerator;
}

/** A customer as the staff sees it: the CPF and the e-mail masked (STF-07). */
export interface CustomerSummary {
  id: string;
  name: string;
  cpfMasked: string;
  emailMasked: string;
  status: CustomerRecord['status'];
  account: { branch: string; number: string; status: CustomerAccount['status'] };
}

/** The demo staff reads only the demo customers (B5, STF-11). */
export function scopeOf(reader: StaffReader): CustomerScope {
  return { onlyDemo: reader.isDemo };
}

export function summaryOf(customer: CustomerRecord, account: CustomerAccount): CustomerSummary {
  return {
    id: customer.id,
    name: customer.name,
    cpfMasked: customer.cpfMasked,
    emailMasked: maskEmail(customer.email),
    status: customer.status,
    account: { branch: account.branch, number: account.number, status: account.status },
  };
}

/**
 * The staff read a customer's personal data (STF-07): written in the read's
 * transaction, so no data leaves without its event.
 */
export function recordAccess(
  deps: CustomerReadsDependencies,
  tx: Transaction,
  reader: StaffReader,
  customerId: string,
  view: 'CUSTOMER' | 'STATEMENT',
): Promise<void> {
  return deps.audit.for(tx).record({
    id: deps.ids.next(),
    occurredAt: deps.clock.now(),
    actorType: 'STAFF',
    actorId: reader.memberId,
    action: 'SENSITIVE_DATA_ACCESSED',
    subjectType: 'USER',
    subjectId: customerId,
    requestId: reader.requestId,
    metadata: { view },
  });
}
