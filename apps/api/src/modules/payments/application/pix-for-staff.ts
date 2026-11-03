import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type { PixTransferState } from '../domain/pix-transfer.ts';
import type { PaymentsRepositoriesFactory } from './ports.ts';

/** A Pix as the staff reads it: to reverse it (v1.3.0, task 5) or for an exception (task 6). */
export interface PixForReversal {
  id: string;
  /** The SPI's id of a Pix to another bank, once sent; the reconciliation's key. */
  endToEndId: string | null;
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

  /** The Pix of the reconciliation's exceptions (v1.3.0, task 6), by the SPI's id. */
  async pixByEndToEndIds(tx: Transaction, endToEndIds: string[]): Promise<PixForReversal[]> {
    if (endToEndIds.length === 0) return [];
    const found = await this.#repositories.for(tx).pixTransfers.findByEndToEndIds(endToEndIds);
    return found.map(reversalViewOf);
  }
}

function reversalViewOf(state: PixTransferState): PixForReversal {
  return {
    id: state.id,
    endToEndId: state.endToEndId,
    payerAccountId: state.payerAccountId,
    payeeAccountId: state.payee.accountId,
    amount: state.amount,
    status: state.status,
    payee: { name: state.payee.name, documentMasked: state.payee.documentMasked },
  };
}
