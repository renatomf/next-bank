import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { type PixTransferView, viewOf } from './pix-transfer-view.ts';
import type { AccountsPort, PaymentsRepositoriesFactory } from './ports.ts';

export interface PixTransferRequest {
  /** From the verified access token: the payer is never taken from the request. */
  userId: string;
  transferId: string;
}

/**
 * The receipt of a Pix (screen 10). Only its payer reaches it: anyone else,
 * the payee included, gets the same NotFound as for a Pix that does not exist.
 */
export class GetPixTransfer {
  readonly #deps: {
    unitOfWork: UnitOfWork;
    repositories: PaymentsRepositoriesFactory;
    accounts: AccountsPort;
  };

  constructor(deps: {
    unitOfWork: UnitOfWork;
    repositories: PaymentsRepositoriesFactory;
    accounts: AccountsPort;
  }) {
    this.#deps = deps;
  }

  async execute(input: PixTransferRequest): Promise<PixTransferView> {
    const { unitOfWork, repositories, accounts } = this.#deps;
    const transfer = await unitOfWork.run(async (tx) => {
      const payer = await accounts.findByHolder(tx, input.userId);
      return payer && repositories.for(tx).pixTransfers.findForPayer(input.transferId, payer.id);
    });
    if (!transfer) throw new NotFound('Pix transfer');
    return viewOf(transfer);
  }
}
