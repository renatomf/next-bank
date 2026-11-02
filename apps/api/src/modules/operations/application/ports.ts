import type { IdempotencyRepository } from '../../../shared/application/idempotency.ts';
import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { ApprovalRequestState, RequestKind } from '../domain/approval-request.ts';
import type { CustomerQuery } from '../domain/customer-query.ts';

/** Who reads, as the staff's session says: never what the client sends (STF-02). */
export interface StaffReader {
  memberId: string;
  /** A member of the public demo: reads only demo customers (B5, STF-11). */
  isDemo: boolean;
  requestId: string | null;
}

/** Which customers a reader may see. */
export interface CustomerScope {
  onlyDemo: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  /** Masked by Identity: the CPF never reaches Operations whole. */
  cpfMasked: string;
  email: string;
  status: 'ACTIVE' | 'LOCKED';
  /** Ana and Bruno: the demo staff never blocks them (task 4, K5). */
  demoProtected: boolean;
}

/** A lookup Identity answers; an account number is Accounts'. */
export type CustomerLookup = Exclude<CustomerQuery, { by: 'ACCOUNT' }>;

/** What Operations needs from Identity (context map); Identity implements it. */
export interface CustomersPort {
  find(tx: Transaction, id: string, scope: CustomerScope): Promise<CustomerRecord | null>;
  findMany(tx: Transaction, ids: string[], scope: CustomerScope): Promise<CustomerRecord[]>;
  search(
    tx: Transaction,
    lookup: CustomerLookup,
    scope: CustomerScope,
    limit: number,
  ): Promise<CustomerRecord[]>;
}

export interface CustomerAccount {
  holderId: string;
  branch: string;
  number: string;
  status: AccountStatus;
  openedAt: Date;
}

export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED';

/** Where a statement page ends; opaque to Operations, which only passes it back. */
export interface StatementPosition {
  createdAt: string;
  postingId: string;
}

export interface StatementItem {
  id: string;
  occurredAt: Date;
  kind: 'PIX_SENT' | 'PIX_RECEIVED' | 'PIX_REFUNDED' | 'DEMO_FUNDING' | 'TOP_UP';
  direction: 'IN' | 'OUT';
  amount: Money;
  counterparty: { name: string; documentMasked: string | null } | null;
  transferId: string | null;
  topUpId: string | null;
}

export interface StatementPage {
  items: StatementItem[];
  next: StatementPosition | null;
}

/** What Operations needs from Accounts (context map); Accounts implements it. */
export interface CustomerAccountsPort {
  ofHolders(tx: Transaction, holderIds: string[]): Promise<CustomerAccount[]>;
  holderOf(tx: Transaction, number: string): Promise<string | null>;
  balanceOf(tx: Transaction, holderId: string): Promise<Money>;
  statementOf(
    tx: Transaction,
    holderId: string,
    after: StatementPosition | null,
  ): Promise<StatementPage>;
}

/** The audit trail on the reader's transaction: the event commits with the read. */
export interface AuditTrailFactory {
  for(tx: Transaction): AuditTrail;
}

/** Who changed an account, and in which request: the audit's actor and trace. */
interface StaffChange {
  holderId: string;
  actorId: string;
  requestId: string | null;
  now: Date;
}

/**
 * What the staff's commands need from Accounts (v1.3.0, task 4); Accounts
 * implements it. Each call locks the account FOR UPDATE, so a block waits
 * for a Pix holding it, and the aggregate refuses a change that does not
 * fit (AccountAlreadyBlocked, AccountNotBlocked).
 */
export interface AccountStatusPort {
  lockStatus(tx: Transaction, holderId: string): Promise<AccountStatus>;
  block(tx: Transaction, input: StaffChange & { reason: string }): Promise<void>;
  unblock(tx: Transaction, input: StaffChange): Promise<void>;
}

/** What a block needs from Identity (K1): the customer locked out, every session ended. */
export interface CustomerAccessPort {
  lockOut(
    tx: Transaction,
    input: { userId: string; actorId: string; requestId: string | null; now: Date },
  ): Promise<void>;
  restore(tx: Transaction, input: { userId: string; now: Date }): Promise<void>;
}

/** The staff members' names, for the requests' screens; the Staff context implements it. */
export interface StaffNamesPort {
  namesOf(tx: Transaction, ids: string[]): Promise<Map<string, string>>;
}

/** Where a page of requests ends: the last one's time and id. */
export interface RequestPosition {
  requestedAt: Date;
  id: string;
}

/** The requests that need two people, append-only (STF-10). */
export interface RequestsRepository {
  insert(state: ApprovalRequestState): Promise<void>;
  /** FOR UPDATE: decisions of one request run one at a time (STF-09). */
  lock(id: string): Promise<ApprovalRequestState | null>;
  find(id: string): Promise<ApprovalRequestState | null>;
  /** Writes the decision the state holds; the primary key keeps it to one. */
  insertDecision(state: ApprovalRequestState): Promise<void>;
  hasPending(customerId: string, kind: RequestKind, now: Date): Promise<boolean>;
  /** Newest first, a page at a time; the demo staff sees the demo ones only. */
  list(filter: {
    status: 'PENDING' | 'ALL';
    onlyDemo: boolean;
    now: Date;
    after: RequestPosition | null;
    limit: number;
  }): Promise<ApprovalRequestState[]>;
}

export interface OperationsRepositories {
  requests: RequestsRepository;
  idempotency: IdempotencyRepository;
  audit: AuditTrail;
}

/** Binds the repositories to the shared transaction (ADR 0010). */
export interface OperationsRepositoriesFactory {
  for(tx: Transaction): OperationsRepositories;
}
