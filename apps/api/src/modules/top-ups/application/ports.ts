import type { IdempotencyRepository } from '../../../shared/application/idempotency.ts';
import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';

export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED';

/** The customer's account, as the accounts context tells it (ADR 0010). */
export interface TopUpAccount {
  id: string;
  holderUserId: string;
  status: AccountStatus;
}

export interface AccountsPort {
  findByHolder(tx: Transaction, userId: string): Promise<TopUpAccount | null>;
  /** Locks the account FOR SHARE, so its status holds until the end (database.md 7). */
  lockForShare(tx: Transaction, accountId: string): Promise<TopUpAccount>;
}

/** How the PIN check ended (ADR 0004); attempts are counted in the same transaction. */
export type PinCheck =
  | { outcome: 'VERIFIED' }
  | { outcome: 'INCORRECT'; remainingAttempts: number }
  | { outcome: 'LOCKED' }
  | { outcome: 'RESET_REQUIRED' };

export interface IdentityPort {
  verifyPin(
    tx: Transaction,
    request: { userId: string; pin: string; requestId: string | null },
  ): Promise<PinCheck>;
}

/** The money leaving for the operator, and who appears on the statement. */
export interface TopUpPosting {
  topUpId: string;
  accountId: string;
  operatorId: string;
  amount: Money;
  /** The operator and the masked number, what the statement shows (READ-02). */
  counterparty: { name: string; documentMasked: string };
}

export interface LedgerPort {
  /**
   * Locks the customer's ledger account (FOR UPDATE), so top-ups of one
   * customer run one at a time and the day's total is read after the lock.
   */
  lockCustomerAccount(tx: Transaction, accountId: string): Promise<void>;
  /**
   * Posts the top-up in the same transaction (ADR 0005). Fails with the
   * catalog's InsufficientFunds before writing anything when the balance does
   * not cover it.
   */
  postTopUp(tx: Transaction, posting: TopUpPosting): Promise<void>;
}

/** What the server asks the operator: the number in full, never stored in clear. */
export interface TopUpRequest {
  topUpId: string;
  operatorId: string;
  phoneDigits: string;
  amount: Money;
}

/**
 * The operator behind a port (D5): a fake one that confirms at once in this
 * version. A real one would need a hold, a timeout and a reversal (phase 4).
 */
export interface TopUpProvider {
  recharge(request: TopUpRequest): Promise<{ reference: string }>;
}

/** The number encrypted with its own key (TOP-01, decision R6). */
export interface ProtectedPhone {
  ciphertext: Uint8Array;
  keyVersion: number;
}

export interface PhoneProtector {
  protect(digits: string): ProtectedPhone;
}

export interface TopUpState {
  id: string;
  accountId: string;
  operatorId: string;
  phoneMasked: string;
  amount: Money;
  /** Every top-up completes in this version (D5). */
  status: 'COMPLETED';
  providerReference: string;
  createdAt: Date;
}

export interface TopUpsRepository {
  insert(topUp: TopUpState, phone: ProtectedPhone): Promise<void>;
  /** What [accountId] topped up since [since]: the day's total for the limit (D6). */
  spentSince(accountId: string, since: Date): Promise<Money>;
  /** The top-up, only when [accountId] owns it (READ-01). */
  findForOwner(id: string, accountId: string): Promise<TopUpState | null>;
}

export interface TopUpsRepositories {
  topUps: TopUpsRepository;
  idempotency: IdempotencyRepository;
  audit: AuditTrail;
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface TopUpsRepositoriesFactory {
  for(tx: Transaction): TopUpsRepositories;
}
