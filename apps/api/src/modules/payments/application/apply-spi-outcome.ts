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

/** The staff's conclusion of a Pix left waiting, after checking with the SPI (task 6). */
export interface StaffConclusion {
  endToEndId: string;
  outcome: 'SETTLED' | 'REJECTED';
  actorId: string;
  requestId: string | null;
  /** The approved request that decided it, cited in the event (task 8, H5). */
  approvalRequestId: string;
}

/** Who ended the Pix, for the audit trail: the system, or a member of the staff. */
interface Author {
  actorType: 'SYSTEM' | 'STAFF';
  actorId: string | null;
  requestId: string | null;
  /** The approval behind a member's conclusion, for the request's trail. */
  approvalRequestId?: string;
}

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

      const system: Author = { actorType: 'SYSTEM', actorId: null, requestId: null };
      await this.#apply(tx, repositories, transfer, outcome, system, now);
      return 'APPLIED';
    });
  }

  /**
   * The staff ends a Pix left waiting for the SPI (v1.3.0 plan, task 6;
   * REC-01), in the transaction of the approval that decided it: the same
   * lock and the same moves as the SPI's answer, so the two never both
   * apply. A Pix no longer waiting moves nothing (X4).
   */
  async concludeByStaff(
    tx: Transaction,
    conclusion: StaffConclusion,
  ): Promise<'APPLIED' | 'NOT_WAITING'> {
    const repositories = this.#deps.repositories.for(tx);
    const state = await repositories.pixTransfers.lockByEndToEndId(conclusion.endToEndId);
    const transfer = state && PixTransfer.restore(state);
    if (!transfer?.waitsForSpi) return 'NOT_WAITING';
    await this.#apply(
      tx,
      repositories,
      transfer,
      { eventId: null, endToEndId: conclusion.endToEndId, status: conclusion.outcome },
      {
        actorType: 'STAFF',
        actorId: conclusion.actorId,
        requestId: conclusion.requestId,
        approvalRequestId: conclusion.approvalRequestId,
      },
      this.#deps.clock.now(),
    );
    return 'APPLIED';
  }

  async #apply(
    tx: Transaction,
    repositories: PaymentsRepositories,
    transfer: PixTransfer,
    outcome: SpiOutcome,
    author: Author,
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
    const { approvalRequestId, ...actor } = author;
    await repositories.audit.record({
      id: this.#deps.ids.next(),
      occurredAt: now,
      ...actor,
      action: outcome.status === 'SETTLED' ? 'PIX_COMPLETED' : 'PIX_FAILED',
      subjectType: 'PIX_TRANSFER',
      subjectId: state.id,
      metadata: {
        endToEndId: outcome.endToEndId,
        ...(outcome.eventId === null ? {} : { eventId: outcome.eventId }),
        ...(approvalRequestId === undefined ? {} : { approvalRequestId }),
      },
    });
  }
}
