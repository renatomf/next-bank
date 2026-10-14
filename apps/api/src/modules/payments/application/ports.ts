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

/** What decrypting a stored value needs: the ciphertext and the key that sealed it. */
export type SealedKeyValue = Pick<ProtectedKeyValue, 'ciphertext' | 'keyVersion'>;

/**
 * Encrypts key values for storage, with a keyed blind index per type to find
 * and keep keys unique without storing them in clear (API-06).
 */
export interface PixKeyValueProtector {
  protect(type: PixKeyType, value: string): ProtectedKeyValue;
  blindIndex(type: PixKeyType, value: string): Uint8Array;
  /** Only for the owner's own random key, which the QR Code has to carry. */
  reveal(type: PixKeyType, sealed: SealedKeyValue): string;
}

/** What a lookup learns from a stored key: never its value. */
export interface StoredPixKey {
  accountId: string;
  masked: string;
}

/** An account's random key as stored: sealed, so only the protector reads it. */
export interface StoredRandomKey extends SealedKeyValue {
  masked: string;
}

export interface PixKeysRepository {
  insert(key: PixKeyState, value: ProtectedKeyValue): Promise<void>;
  findByIndex(type: PixKeyType, blindIndex: Uint8Array): Promise<StoredPixKey | null>;
  /** False when the account already has one: concurrent callers keep a single key. */
  insertRandomIfAbsent(key: PixKeyState, value: ProtectedKeyValue): Promise<boolean>;
  findRandomOf(accountId: string): Promise<StoredRandomKey | null>;
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
  /**
   * Reads the accounts locked for share: their status cannot change until the
   * transaction ends (database.md 7). Accounts that do not exist are left out.
   */
  lockForShare(tx: Transaction, accountIds: string[]): Promise<PayeeAccount[]>;
}

/** The outcome of a PIN check, as a value the Pix can record (ADR 0010, rule 3). */
export type PinCheck =
  | { outcome: 'VERIFIED' }
  | { outcome: 'INCORRECT'; remainingAttempts: number }
  | { outcome: 'LOCKED'; lockedUntil: Date }
  | { outcome: 'RESET_REQUIRED' };

/** What Payments needs from Identity (context map, domain-model.md section 2). */
export interface IdentityPort {
  /** Who the payee is, for the snapshot (D6). */
  payeeOf(
    tx: Transaction,
    userId: string,
  ): Promise<{ name: string; documentMasked: string } | null>;
  /**
   * Checks the PIN on the server in the Pix transaction, with the PIN locked
   * until it commits (PIX-05); fails with PinNotCreated when there is none.
   */
  verifyPin(
    tx: Transaction,
    input: { userId: string; pin: string; requestId: string | null },
  ): Promise<PinCheck>;
}

/** One side of a Pix, as the other side's statement shows it. */
export interface PixParty {
  name: string;
  documentMasked: string;
}

export interface PixPosting {
  transferId: string;
  payerAccountId: string;
  payeeAccountId: string;
  amount: Money;
  payer: PixParty;
  payee: PixParty;
}

/** What Payments needs from the Ledger (context map, domain-model.md section 2). */
export interface LedgerPort {
  availableBalance(tx: Transaction, accountId: string): Promise<Money | null>;
  /**
   * Posts the Pix in the same transaction (ADR 0005). Fails with the catalog's
   * InsufficientFunds before writing anything when the balance does not cover it.
   */
  postPixTransfer(tx: Transaction, posting: PixPosting): Promise<void>;
}

/** The end-to-end id of a completed Pix (D10); random, so it comes from outside the domain. */
export interface EndToEndIds {
  next(completedAt: Date): string;
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
