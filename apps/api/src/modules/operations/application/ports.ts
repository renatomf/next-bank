import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
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
  status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  openedAt: Date;
}

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
