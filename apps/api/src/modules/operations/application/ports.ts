import type { IdempotencyRepository } from '../../../shared/application/idempotency.ts';
import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { ApprovalRequestState, RequestKind } from '../domain/approval-request.ts';
import type { CustomerQuery } from '../domain/customer-query.ts';
import type { ExceptionState, ResolutionState } from '../domain/reconciliation-exception.ts';

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
  kind: 'PIX_SENT' | 'PIX_RECEIVED' | 'PIX_REFUNDED' | 'PIX_REVERSED' | 'DEMO_FUNDING' | 'TOP_UP';
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
  /** The customer who holds this account (v1.3.0, task 5). */
  holderOfAccount(tx: Transaction, accountId: string): Promise<string | null>;
  /** The id of the customer's account, the subject of its events (v1.3.0, task 8). */
  accountIdOf(tx: Transaction, holderId: string): Promise<string | null>;
  /** The holder of each of these accounts, by account id, in one read (v1.3.0, task 6). */
  holdersOfAccounts(tx: Transaction, accountIds: string[]): Promise<Map<string, string>>;
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
  /** A member's name and whether it is the public demo's, for its trail (task 8, STF-11). */
  memberOf(tx: Transaction, id: string): Promise<{ name: string; isDemo: boolean } | null>;
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
  /** A pending reversal of this Pix: one at a time (v1.3.0, task 5). */
  hasPendingForTransfer(transferId: string, now: Date): Promise<boolean>;
  /** The pending request of each of these exceptions, by exception id (v1.3.0, task 6). */
  pendingForExceptions(exceptionIds: string[], now: Date): Promise<Map<string, string>>;
  /** Newest first, a page at a time; the demo staff sees the demo ones only. */
  list(filter: {
    status: 'PENDING' | 'ALL';
    onlyDemo: boolean;
    now: Date;
    after: RequestPosition | null;
    limit: number;
    /** Only the requests this member asked; null for everyone's. */
    requestedBy: string | null;
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

/** A Pix as the staff's reversal reads it; the amount is the Pix's own (PIX-14). */
export interface CompletedPix {
  id: string;
  /** The SPI's id of a Pix to another bank, once sent; the reconciliation's key. */
  endToEndId: string | null;
  payerAccountId: string;
  /** Null for a Pix to another bank, never reversed here (B9). */
  payeeAccountId: string | null;
  amount: Money;
  status: string;
  payee: { name: string; documentMasked: string };
}

/** What a reversal needs from Payments (v1.3.0, task 5); Payments implements it. */
export interface PixTransfersPort {
  pixById(tx: Transaction, transferId: string): Promise<CompletedPix | null>;
  pixByIds(tx: Transaction, ids: string[]): Promise<CompletedPix[]>;
  /** The Pix of the reconciliation's exceptions (v1.3.0, task 6); those not here are left out. */
  pixByEndToEndIds(tx: Transaction, endToEndIds: string[]): Promise<CompletedPix[]>;
}

/** Who was on each side, as the statement shows them. */
interface PixParty {
  name: string;
  documentMasked: string;
}

/**
 * What a reversal needs from the ledger (v1.3.0, task 5): a new entry from
 * payee to payer, once per Pix, never below zero. A payee without the money
 * is an answer, not an error: the request stays pending (V1).
 */
export interface PixReversalsPort {
  isReversed(tx: Transaction, transferId: string): Promise<boolean>;
  reverse(
    tx: Transaction,
    posting: {
      transferId: string;
      payerAccountId: string;
      payeeAccountId: string;
      amount: Money;
      payer: PixParty;
      payee: PixParty;
    },
  ): Promise<'REVERSED' | 'PAYEE_WITHOUT_FUNDS'>;
}

/** Where a page of exceptions ends: the last one's time and id. */
export interface ExceptionPosition {
  detectedAt: Date;
  id: string;
}

/**
 * What the exceptions queue needs from the reconciliation (v1.3.0, task 6);
 * the reconciliation implements it. Each exception comes with its
 * resolution, if it has one; the exception itself is never written (R5).
 */
export interface ReconciliationExceptionsPort {
  /** Newest first, a page at a time; open only or all of them. */
  exceptionsPage(
    tx: Transaction,
    filter: { status: 'OPEN' | 'ALL'; after: ExceptionPosition | null; limit: number },
  ): Promise<ExceptionState[]>;
  exceptionById(tx: Transaction, id: string): Promise<ExceptionState | null>;
  /** FOR UPDATE: a request and an explanation of one exception run one at a time. */
  lockException(tx: Transaction, id: string): Promise<ExceptionState | null>;
  /** One per exception: the primary key refuses a second. */
  recordResolution(tx: Transaction, resolution: ResolutionState): Promise<void>;
}

/**
 * Ends a Pix left waiting for the SPI as the SPI's answer would, with the
 * staff as its author (v1.3.0, task 6; REC-01); Payments implements it. A
 * Pix no longer waiting is an answer, not an error: nothing moves (X4).
 */
export interface StalePixPort {
  concludeWaitingPix(
    tx: Transaction,
    input: {
      endToEndId: string;
      outcome: 'SETTLED' | 'REJECTED';
      actorId: string;
      requestId: string | null;
      /** The approved request that decided it, cited in the Pix's event (task 8, H5). */
      approvalRequestId: string;
    },
  ): Promise<'APPLIED' | 'NOT_WAITING'>;
}

/**
 * Which events a reading of the trail asks for: exactly one of the three
 * (STF-16). A customer's and a member's hold what they did and what
 * happened to them.
 */
export type AuditFilter =
  | { by: 'CUSTOMER'; customerId: string; accountId: string | null }
  | { by: 'MEMBER'; memberId: string }
  | { by: 'REQUEST'; requestId: string };

/** Where a page of the trail ends: the last event's time and id. */
export interface AuditPosition {
  occurredAt: Date;
  id: string;
}

/** An event of the trail as recorded (v1.3.0, task 8). */
export interface AuditRecord {
  id: string;
  occurredAt: Date;
  actorType: 'USER' | 'SYSTEM' | 'STAFF';
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

/** What the trail's screen needs from the Audit context, which implements it (task 8). */
export interface AuditReaderPort {
  /** Newest first, a page at a time; the trail itself is only ever inserted into (STF-10). */
  eventsOf(
    tx: Transaction,
    filter: AuditFilter,
    after: AuditPosition | null,
    limit: number,
  ): Promise<AuditRecord[]>;
}
