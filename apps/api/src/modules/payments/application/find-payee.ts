import type { Transaction } from '../../../shared/application/ports.ts';
import type { PayeeBank } from '../domain/pix-transfer.ts';
import { isRegisteredHere, maskedKeyValue, type PixKeyType } from '../domain/pix-key.ts';
import type {
  AccountsPort,
  IdentityPort,
  PaymentsRepositories,
  PixKeyValueProtector,
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
