import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { PixKeyState, PixKeyType } from '../domain/pix-key.ts';
import type { PixTransferState } from '../domain/pix-transfer.ts';

/** How a key value is stored: never in clear (database.md, section 2). */
export interface ProtectedKeyValue {
  ciphertext: Uint8Array;
  blindIndex: Uint8Array;
  keyVersion: number;
}

/**
 * Encrypts key values for storage, with a keyed blind index per type to find
 * and keep keys unique without storing them in clear (API-06).
 */
export interface PixKeyValueProtector {
  protect(type: PixKeyType, value: string): ProtectedKeyValue;
  blindIndex(type: PixKeyType, value: string): Uint8Array;
}

/** What a lookup learns from a stored key: never its value. */
export interface StoredPixKey {
  accountId: string;
  masked: string;
}

export interface PixKeysRepository {
  insert(key: PixKeyState, value: ProtectedKeyValue): Promise<void>;
  findByIndex(type: PixKeyType, blindIndex: Uint8Array): Promise<StoredPixKey | null>;
}

/** A Pix is always looked up with its payer's account: anyone else finds nothing (PIX-01). */
export interface PixTransfersRepository {
  insert(transfer: PixTransferState): Promise<void>;
  findForPayer(id: string, payerAccountId: string): Promise<PixTransferState | null>;
  /** Locks the Pix until the transaction ends: it changes state once (PIX-08). */
  lockForPayer(id: string, payerAccountId: string): Promise<PixTransferState | null>;
  update(transfer: PixTransferState): Promise<void>;
}

/** The answer a request produced, kept so a repeated request gets the same one. */
export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyClaim {
  userId: string;
  key: string;
  operation: 'pix.create' | 'pix.authorize';
  /** Keyed hash of the request; never covers the PIN (D4). */
  requestHash: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
}

export type ClaimResult =
  | { claimed: true }
  | {
      claimed: false;
      operation: string;
      requestHash: Uint8Array;
      /** Null while the first request is still running. */
      response: StoredResponse | null;
    };

/** One record per customer and key (ADR 0007; database.md 5.4). */
export interface IdempotencyRepository {
  /**
   * Claims the key for this request, or returns what the earlier one left. A
   * concurrent request with the same key waits here until the first commits;
   * waiting too long fails with RequestInProgress.
   */
  claim(claim: IdempotencyClaim): Promise<ClaimResult>;
  complete(userId: string, key: string, response: StoredResponse): Promise<void>;
}

/** A keyed hash of a request, so a dump cannot brute-force what it contained. */
export interface RequestFingerprint {
  of(operation: string, payload: unknown): Uint8Array;
}

export type AccountStatus = 'ACTIVE' | 'BLOCKED' | 'CLOSED';

export interface PayeeAccount {
  id: string;
  holderUserId: string;
  status: AccountStatus;
}

/**
 * What Payments needs from Accounts (context map, domain-model.md section 2).
 * Defined here, by the caller; Accounts implements it.
 */
export interface AccountsPort {
  findById(tx: Transaction, accountId: string): Promise<PayeeAccount | null>;
  /** The payer's account always comes from the token's user (PIX-01). */
  findByHolder(tx: Transaction, userId: string): Promise<PayeeAccount | null>;
}

/** What Payments needs from Identity: who the payee is, for the snapshot (D6). */
export interface IdentityPort {
  payeeOf(
    tx: Transaction,
    userId: string,
  ): Promise<{ name: string; documentMasked: string } | null>;
}

/** What Payments needs from the Ledger (context map, domain-model.md section 2). */
export interface LedgerPort {
  availableBalance(tx: Transaction, accountId: string): Promise<Money | null>;
}

/**
 * Lookups each customer may still make (domain-model.md 7, PIX-07). Taking is
 * synchronous on purpose: no await between the check and the count (F-11).
 */
export interface KeyLookupQuota {
  /** Spends [cost] lookups, or answers false when they are not left. */
  tryTake(customerId: string, cost: number, now: Date): boolean;
  /** Spends [cost] more, even past the limit: a missing key costs twice. */
  charge(customerId: string, cost: number, now: Date): void;
}

export interface PaymentsRepositories {
  pixKeys: PixKeysRepository;
  pixTransfers: PixTransfersRepository;
  idempotency: IdempotencyRepository;
  audit: AuditTrail;
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories;
}
