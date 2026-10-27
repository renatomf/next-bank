import type { Transaction } from '../../../shared/application/ports.ts';
import type { PayeeBank, PixPayee } from '../domain/pix-transfer.ts';
import {
  isRegisteredHere,
  maskedKeyValue,
  type PixKeyType,
  pixKeyValue,
} from '../domain/pix-key.ts';
import type {
  AccountsPort,
  IdentityPort,
  PaymentsRepositories,
  PixKeyValueProtector,
  SealedKeyValue,
  SpiPort,
} from './ports.ts';

/** Who a key names, as the payer may see it (D6): the document only masked. */
interface FoundPayee {
  name: string;
  documentMasked: string;
  keyMasked: string;
}

export interface PayeeHere extends FoundPayee {
  accountId: string;
}

export interface PayeeElsewhere extends FoundPayee {
  bank: PayeeBank;
}

/** The key at next bank, read in the caller's transaction; null when it is not here. */
export async function findPayeeHere(
  deps: { protector: PixKeyValueProtector; accounts: AccountsPort; identity: IdentityPort },
  tx: Transaction,
  repositories: PaymentsRepositories,
  key: { type: PixKeyType; value: string },
): Promise<PayeeHere | null> {
  if (!isRegisteredHere(key.type)) return null;
  const found = await repositories.pixKeys.findByIndex(
    key.type,
    deps.protector.blindIndex(key.type, key.value),
  );
  if (found === null) return null;
  const account = await deps.accounts.findById(tx, found.accountId);
  const payee = account && (await deps.identity.payeeOf(tx, account.holderUserId));
  // A key always belongs to an account with a holder: anything else is a bug.
  if (!payee) throw new Error(`Pix key without a payee for account ${found.accountId}`);
  return { accountId: found.accountId, keyMasked: found.masked, ...payee };
}

/**
 * The key at another bank, asked of the DICT (v1.2.0 plan, task 3); null when
 * no bank holds it under this type, or while the Pix to other banks is off
 * (spi null, P1). A DICT that does not answer throws: it is not a miss.
 */
export async function findPayeeElsewhere(
  spi: SpiPort | null,
  key: { type: PixKeyType; value: string },
): Promise<PayeeElsewhere | null> {
  if (spi === null) return null;
  const found = await spi.findKey(key.value);
  if (found?.keyType !== key.type) return null;
  return {
    bank: found.bank,
    name: found.owner.name,
    documentMasked: found.owner.documentMasked,
    keyMasked: maskedKeyValue(key.type, key.value),
  };
}

export interface ResolvedPayee {
  /** As the Pix or the schedule keeps it (P3, S1). */
  payee: PixPayee;
  /** Only for a payee at another bank: the key, sealed, goes to the SPI. */
  payeeKey?: SealedKeyValue;
}

/**
 * Who a key names, at next bank or else at another bank; null when no key can
 * have this value or nobody holds it. The DICT is asked in the caller's
 * transaction, so the client's short deadline bounds the wait.
 */
export async function resolvePayee(
  deps: {
    protector: PixKeyValueProtector;
    accounts: AccountsPort;
    identity: IdentityPort;
    spi: SpiPort | null;
  },
  tx: Transaction,
  repositories: PaymentsRepositories,
  raw: { type: PixKeyType; value: string },
): Promise<ResolvedPayee | null> {
  const value = normalized(raw.type, raw.value);
  if (value === null) return null;
  const key = { type: raw.type, value };
  const here = await findPayeeHere(deps, tx, repositories, key);
  const shown = (found: PayeeHere | PayeeElsewhere) => ({
    name: found.name,
    documentMasked: found.documentMasked,
    keyType: key.type,
    keyMasked: found.keyMasked,
  });
  if (here !== null) return { payee: { ...shown(here), accountId: here.accountId } };
  const elsewhere = await findPayeeElsewhere(deps.spi, key);
  if (elsewhere === null) return null;
  // Only what decrypting needs: the blind index finds keys of next bank, not this one.
  const { ciphertext, keyVersion } = deps.protector.protect(key.type, key.value);
  return {
    payee: { ...shown(elsewhere), accountId: null, bank: elsewhere.bank },
    payeeKey: { ciphertext, keyVersion },
  };
}

/** The key as stored, or null when no key can have this value. */
export function normalized(type: PixKeyType, raw: string): string | null {
  try {
    return pixKeyValue(type, raw);
  } catch {
    return null;
  }
}
