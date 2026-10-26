import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { PixTransfer } from '../domain/pix-transfer.ts';
import type { LedgerPort, PaymentsRepositories, PaymentsRepositoriesFactory } from './ports.ts';

/** What the SPI says of a Pix it took, by webhook or when asked. */
export interface SpiOutcome {
  /** The webhook's event id; null when the answer comes from the status check. */
  eventId: string | null;
  endToEndId: string;
  status: 'SETTLED' | 'REJECTED';
}

/** Applied; ignored (and recorded); or an event already taken. */
export type SpiOutcomeResult = 'APPLIED' | 'IGNORED' | 'DUPLICATE';

export interface ApplySpiOutcomeDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  ledger: LedgerPort;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * Ends a Pix to another bank with the SPI's answer (v1.2.0 plan, task 4),
 * whether it came by webhook or by the status check. In one transaction:
 * the Pix is locked first (database.md 7), so two answers for it run one at
 * a time and the second finds it final; then the event goes into the inbox,
 * where one already taken stops here (EXT-02); then the money moves. A
 * refund only ever follows the SPI's refusal (D6).
 */
export class ApplySpiOutcome {
  readonly #deps: ApplySpiOutcomeDependencies;

  constructor(deps: ApplySpiOutcomeDependencies) {
    this.#deps = deps;
  }

  execute(outcome: SpiOutcome): Promise<SpiOutcomeResult> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const repositories = this.#deps.repositories.for(tx);
      const state = await repositories.pixTransfers.lockByEndToEndId(outcome.endToEndId);
      const transfer = state && PixTransfer.restore(state);
      const applies = transfer?.waitsForSpi === true;
      if (outcome.eventId !== null) {
        const first = await repositories.inbox.record({
          eventId: outcome.eventId,
          source: 'spi',
          outcome: applies ? 'APPLIED' : 'IGNORED',
          receivedAt: now,
        });
        if (!first) return 'DUPLICATE';
      }
      if (!transfer || !applies) return 'IGNORED';

      await this.#apply(tx, repositories, transfer, outcome, now);
      return 'APPLIED';
    });
  }

  async #apply(
    tx: Transaction,
    repositories: PaymentsRepositories,
    transfer: PixTransfer,
    outcome: SpiOutcome,
    now: Date,
  ): Promise<void> {
    const { state } = transfer;
    if (outcome.status === 'SETTLED') {
      transfer.settle(now);
      await this.#deps.ledger.settleExternalPix(tx, {
        transferId: state.id,
        amount: state.amount,
      });
    } else {
      transfer.rejectBySpi(now);
      await this.#deps.ledger.refundExternalPix(tx, {
        transferId: state.id,
        payerAccountId: state.payerAccountId,
        amount: state.amount,
        payee: { name: state.payee.name, documentMasked: state.payee.documentMasked },
      });
    }
    await repositories.pixTransfers.update(transfer.state);
    await repositories.audit.record({
      id: this.#deps.ids.next(),
      occurredAt: now,
      actorType: 'SYSTEM',
      actorId: null,
      action: outcome.status === 'SETTLED' ? 'PIX_COMPLETED' : 'PIX_FAILED',
      subjectType: 'PIX_TRANSFER',
      subjectId: state.id,
      requestId: null,
      metadata: {
        endToEndId: outcome.endToEndId,
        ...(outcome.eventId === null ? {} : { eventId: outcome.eventId }),
      },
    });
  }
}
