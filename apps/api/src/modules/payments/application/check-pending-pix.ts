import type { Outbox } from '../../../shared/application/outbox.ts';
import type { Clock, UnitOfWork } from '../../../shared/application/ports.ts';
import type { ApplySpiOutcome } from './apply-spi-outcome.ts';
import { SEND_EXTERNAL_PIX } from './process-pix.ts';
import type { PaymentsRepositoriesFactory, SpiPort } from './ports.ts';

export interface CheckPendingPixDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  spi: SpiPort;
  outbox: Outbox;
  applySpiOutcome: ApplySpiOutcome;
  clock: Clock;
}

/** The webhook's time to come before the SPI is asked (W2). */
const WEBHOOK_GRACE_MS = 2 * 60_000;
/** Pix asked about per round, so a long outage never floods the SPI (W2). */
const PER_ROUND = 20;

/**
 * The status check (v1.2.0 plan, task 4; EXT-03): the Pix to another bank
 * still waiting after the webhook's grace are asked about, the oldest first.
 * Settled or refused, the answer is applied as the webhook's would be.
 * Unknown to the SPI, the Pix is sent again with its end-to-end id, which
 * the SPI takes once (W3). Pending, or no answer at all, changes nothing: a
 * refund only follows a refusal (D6). Each Pix is checked on its own, with
 * no transaction open while the SPI is asked.
 */
export class CheckPendingPix {
  readonly #deps: CheckPendingPixDependencies;

  constructor(deps: CheckPendingPixDependencies) {
    this.#deps = deps;
  }

  /** Checks one round; returns how many Pix were asked about. */
  async execute(): Promise<number> {
    const { unitOfWork, repositories, clock } = this.#deps;
    const authorizedBefore = new Date(clock.now().getTime() - WEBHOOK_GRACE_MS);
    const waiting = await unitOfWork.run((tx) =>
      repositories.for(tx).pixTransfers.findWaitingForSpi(authorizedBefore, PER_ROUND),
    );
    for (const pix of waiting) await this.#check(pix);
    return waiting.length;
  }

  async #check(pix: { id: string; endToEndId: string }): Promise<void> {
    let status;
    try {
      status = await this.#deps.spi.status(pix.endToEndId);
    } catch {
      // The SPI did not answer: the next round asks again (EXT-08).
      return;
    }
    if (status === 'SETTLED' || status === 'REJECTED') {
      await this.#deps.applySpiOutcome.execute({
        eventId: null,
        endToEndId: pix.endToEndId,
        status,
      });
    } else if (status === null) {
      await this.#deps.unitOfWork.run((tx) =>
        this.#deps.outbox.enqueue(tx, {
          type: SEND_EXTERNAL_PIX,
          payload: { transferId: pix.id },
          requestId: null,
        }),
      );
    }
  }
}
