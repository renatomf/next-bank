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

export interface PixKeysRepository {
  insert(key: PixKeyState, value: ProtectedKeyValue): Promise<void>;
}

export interface PaymentsRepositories {
  pixKeys: PixKeysRepository;
}

/** Binds the repositories to the shared transaction opened by the caller (ADR 0010). */
export interface PaymentsRepositoriesFactory {
  for(tx: Transaction): PaymentsRepositories;
}
