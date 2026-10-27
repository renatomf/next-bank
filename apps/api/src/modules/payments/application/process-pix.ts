import type { Transaction } from '../../../shared/application/ports.ts';
import type { Outbox } from '../../../shared/application/outbox.ts';
import { DomainError } from '../../../shared/domain/domain-error.ts';
import type { PixFailureReason, PixTransfer } from '../domain/pix-transfer.ts';
import type { AccountsPort, EndToEndIds, IdentityPort, LedgerPort, PayeeAccount } from './ports.ts';

/** The message that sends a Pix to another bank to the SPI. */
export const SEND_EXTERNAL_PIX = 'pix.send-external';

export interface ProcessPixDependencies {
  accounts: AccountsPort;
  identity: IdentityPort;
  ledger: LedgerPort;
  endToEndIds: EndToEndIds;
  /** Where a Pix to another bank waits to be sent to the SPI (ADR 0016). */
  outbox: Outbox;
}

/**
 * What an authorized Pix goes through, whoever authorized it: the customer's
 * PIN, or the schedule's, given when scheduling (v1.2.0 plan, task 7). In the
 * caller's transaction, with the locks after the ones the caller holds
 * (database.md section 7): the accounts for share and the ledger accounts by
 * id. The checks of balance, limit and accounts made here are the ones that
 * count (domain-model.md 4). The caller saves the Pix.
 */
export async function processPix(
  deps: ProcessPixDependencies,
  tx: Transaction,
  transfer: PixTransfer,
  payer: PayeeAccount,
  now: Date,
  requestId: string | null,
): Promise<void> {
  transfer.startProcessing(now);
  const failure = await post(deps, tx, transfer, payer, now);
  const endToEndId = deps.endToEndIds.next(now);
  if (failure !== null) {
    transfer.fail(failure, now);
  } else if (transfer.goesToAnotherBank) {
    // Debited, the Pix waits for the SPI; the message that sends it commits
    // with the debit or not at all (ADR 0016), and carries only the id.
    transfer.awaitSettlement(endToEndId);
    await deps.outbox.enqueue(tx, {
      type: SEND_EXTERNAL_PIX,
      payload: { transferId: transfer.state.id },
      requestId,
    });
  } else {
    transfer.complete(endToEndId, now);
  }
}

/** Posts the Pix, or says why it fails; a failure writes nothing in the ledger. */
async function post(
  deps: ProcessPixDependencies,
  tx: Transaction,
  transfer: PixTransfer,
  payer: PayeeAccount,
  now: Date,
): Promise<PixFailureReason | null> {
  const { accounts, identity, ledger } = deps;
  const { state } = transfer;
  // A payee at another bank has no account here to lock or check.
  const payeeAccountId = state.payee.accountId;
  const locked = await accounts.lockForShare(
    tx,
    payeeAccountId === null ? [payer.id] : [payer.id, payeeAccountId],
  );
  const statusOf = (id: string) => locked.find((account) => account.id === id)?.status;
  if (statusOf(payer.id) !== 'ACTIVE') return 'ACCOUNT_BLOCKED';
  if (payeeAccountId !== null && statusOf(payeeAccountId) !== 'ACTIVE') {
    return 'PAYEE_UNAVAILABLE';
  }
  if (transfer.exceedsLimitAt(now)) return 'LIMIT_EXCEEDED';

  const payee = { name: state.payee.name, documentMasked: state.payee.documentMasked };
  try {
    if (payeeAccountId === null) {
      await ledger.postExternalPix(tx, {
        transferId: state.id,
        payerAccountId: payer.id,
        amount: state.amount,
        payee,
      });
    } else {
      const payerParty = await identity.payeeOf(tx, payer.holderUserId);
      if (!payerParty) throw new Error(`Customer ${payer.holderUserId} has no profile`);
      await ledger.postPixTransfer(tx, {
        transferId: state.id,
        payerAccountId: payer.id,
        payeeAccountId,
        amount: state.amount,
        payer: payerParty,
        payee,
      });
    }
  } catch (error) {
    // The ledger refuses before writing: the transaction stays usable.
    if (error instanceof DomainError && error.code === 'InsufficientFunds') {
      return 'INSUFFICIENT_FUNDS';
    }
    throw error;
  }
  return null;
}
