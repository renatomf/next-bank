import type { Clock, IdGenerator, UnitOfWork } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { PixTransfer } from '../domain/pix-transfer.ts';
import type { PixTransferRequest } from './get-pix-transfer.ts';
import { type PixTransferView, viewOf } from './pix-transfer-view.ts';
import type { AccountsPort, PaymentsRepositoriesFactory } from './ports.ts';

export interface CancelPixTransferInput extends PixTransferRequest {
  sessionId: string;
  requestId: string | null;
}

/**
 * The customer gives up a Pix before typing the PIN (domain-model.md 4). The
 * Pix is locked, so a cancel and an authorization never both succeed (PIX-08).
 */
export class CancelPixTransfer {
  readonly #deps: {
    unitOfWork: UnitOfWork;
    repositories: PaymentsRepositoriesFactory;
    accounts: AccountsPort;
    clock: Clock;
    ids: IdGenerator;
  };

  constructor(deps: {
    unitOfWork: UnitOfWork;
    repositories: PaymentsRepositoriesFactory;
    accounts: AccountsPort;
    clock: Clock;
    ids: IdGenerator;
  }) {
    this.#deps = deps;
  }

  execute(input: CancelPixTransferInput): Promise<PixTransferView> {
    const { unitOfWork, repositories, accounts, clock, ids } = this.#deps;
    return unitOfWork.run(async (tx) => {
      const payer = await accounts.findByHolder(tx, input.userId);
      const { pixTransfers, audit } = repositories.for(tx);
      const state = payer && (await pixTransfers.lockForPayer(input.transferId, payer.id));
      if (!state) throw new NotFound('Pix transfer');

      const now = clock.now();
      const transfer = PixTransfer.restore(state);
      transfer.cancel(now);
      await pixTransfers.update(transfer.state);
      await audit.record({
        id: ids.next(),
        occurredAt: now,
        actorType: 'USER',
        actorId: input.userId,
        action: 'PIX_CANCELLED',
        subjectType: 'PIX_TRANSFER',
        subjectId: transfer.state.id,
        requestId: input.requestId,
        metadata: { sessionId: input.sessionId, reason: 'CUSTOMER' },
      });
      return viewOf(transfer.state);
    });
  }
}
