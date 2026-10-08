import type { Transaction } from '../../../shared/application/ports.ts';
import type { PixKeyState, PixKeyType } from '../domain/pix-key.ts';

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
}

/** What Payments needs from Identity: who the payee is, for the snapshot (D6). */
export interface IdentityPort {
  payeeOf(
    tx: Transaction,
    userId: string,
  ): Promise<{ name: string; documentMasked: string } | null>;
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
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories;
}
