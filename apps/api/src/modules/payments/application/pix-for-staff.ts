import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { PixTransferState } from '../domain/pix-transfer.ts';
import type { PaymentsRepositoriesFactory } from './ports.ts';

/** A Pix as the staff's reversal reads it (v1.3.0 plan, task 5). */
export interface PixForReversal {
  id: string;
  payerAccountId: string;
  /** Null for a Pix to another bank, which the staff never reverses here (B9). */
  payeeAccountId: string | null;
  amount: Money;
  status: string;
  payee: { name: string; documentMasked: string };
}

/**
 * Payments' answer to the port Operations defines, in the caller's
 * transaction: any customer's Pix by id, for the staff only. The amount is
 * the Pix's own, never one a request brings (PIX-14).
 */
export class PixForStaff {
  readonly #repositories: PaymentsRepositoriesFactory;

  constructor(repositories: PaymentsRepositoriesFactory) {
    this.#repositories = repositories;
  }

  async pixById(tx: Transaction, transferId: string): Promise<PixForReversal | null> {
    const [pix] = await this.pixByIds(tx, [transferId]);
    return pix ?? null;
  }

  async pixByIds(tx: Transaction, ids: string[]): Promise<PixForReversal[]> {
    const found = await this.#repositories.for(tx).pixTransfers.findByIds(ids);
    return found.map(reversalViewOf);
  }
}

function reversalViewOf(state: PixTransferState): PixForReversal {
  return {
    id: state.id,
    payerAccountId: state.payerAccountId,
    payeeAccountId: state.payee.accountId,
    amount: state.amount,
    status: state.status,
    payee: { name: state.payee.name, documentMasked: state.payee.documentMasked },
  };
}
