import type { DeliveredMessage } from '../../../shared/application/outbox.ts';
import type { UnitOfWork } from '../../../shared/application/ports.ts';
import { NEXT_BANK_ISPB } from '../domain/end-to-end-id.ts';
import type {
  AccountsPort,
  IdentityPort,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
  SpiPayment,
  SpiPort,
} from './ports.ts';

export interface SendExternalPixDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  protector: PixKeyValueProtector;
  accounts: AccountsPort;
  identity: IdentityPort;
  spi: SpiPort;
}

/**
 * Delivers pix.send-external (v1.2.0 plan, task 3; ADR 0016): sends a Pix
 * to another bank to the SPI. Delivery is at least once, and every attempt
 * carries the end-to-end id drawn at authorization, so the SPI takes the Pix
 * once however often this runs (EXT-03). What is sent is read in a short
 * transaction and sent with none open.
 */
export class SendExternalPix {
  readonly #deps: SendExternalPixDependencies;

  constructor(deps: SendExternalPixDependencies) {
    this.#deps = deps;
  }

  async handle(message: DeliveredMessage): Promise<void> {
    const { transferId } = message.payload;
    if (typeof transferId !== 'string') throw new Error(`Message ${message.id} has no Pix id`);
    const payment = await this.#paymentOf(transferId);
    if (payment !== null) await this.#deps.spi.send(payment);
  }

  /** The payment to send, or null when there is nothing left to send. */
  #paymentOf(transferId: string): Promise<SpiPayment | null> {
    const { unitOfWork, repositories, protector, accounts, identity } = this.#deps;
    return unitOfWork.run(async (tx) => {
      const found = await repositories.for(tx).pixTransfers.findExternalForSending(transferId);
      // Written with the Pix in the same transaction: a missing one is a bug.
      if (found === null) throw new Error(`No Pix to another bank ${transferId}`);
      const { transfer, payeeKey } = found;
      // Answered by the SPI already (task 4): sending again would change nothing.
      if (transfer.status !== 'PROCESSING' || transfer.endToEndId === null) return null;

      const payerAccount = await accounts.findById(tx, transfer.payerAccountId);
      const payer = payerAccount && (await identity.payeeOf(tx, payerAccount.holderUserId));
      if (!payer) throw new Error(`Pix ${transferId} without a payer profile`);
      return {
        endToEndId: transfer.endToEndId,
        amount: transfer.amount,
        payer: { ispb: NEXT_BANK_ISPB, ...payer },
        payeeKey: protector.reveal(transfer.payee.keyType, payeeKey),
      };
    });
  }
}
