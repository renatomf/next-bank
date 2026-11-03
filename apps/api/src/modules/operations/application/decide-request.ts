import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { Transaction } from '../../../shared/application/ports.ts';
import { concludeException } from './exceptions.ts';
import type { StaffReader } from './ports.ts';
import { reversePix } from './request-reversal.ts';
import {
  type CommandDependencies,
  lockedRequestFor,
  requestEvent,
  type RequestView,
  viewOf,
} from './staff-commands.ts';

/**
 * Approves or rejects a request, by someone other than its requester
 * (v1.3.0 plan, B6; STF-03). The request is locked, so it is decided once
 * (STF-09); an approval runs its command in the same transaction: an unblock
 * lets the customer sign in again, a reversal gives the Pix back, and a
 * resolution ends a Pix left waiting for the SPI (task 6).
 */
export class DecideRequest {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: {
      requestId: string;
      decision: 'APPROVE' | 'REJECT';
      note: string | null;
      idempotencyKey: string;
    },
  ): Promise<RequestView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.decide',
          payload: { requestId: input.requestId, decision: input.decision, note: input.note },
          now,
        },
        async () => {
          const request = await lockedRequestFor(this.#deps, tx, actor, input.requestId);
          if (input.decision === 'APPROVE') {
            request.approve(actor.memberId, now, input.note);
            switch (request.state.kind) {
              case 'REVERSE_PIX':
                await reversePix(this.#deps, tx, actor, request.state, now);
                break;
              case 'RESOLVE_EXCEPTION':
                await concludeException(this.#deps, tx, actor, request.state, now);
                break;
              case 'UNBLOCK_ACCOUNT':
                await this.#unblock(tx, actor, request.state.customerId, now);
            }
          } else {
            request.reject(actor.memberId, now, input.note);
          }
          await repositories.requests.insertDecision(request.state);
          const action = input.decision === 'APPROVE' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED';
          await repositories.audit.record(
            requestEvent(this.#deps, actor, request.state, action, now),
          );
          return { status: 200, body: await viewOf(this.#deps, tx, request.state, now) };
        },
      );
    });
    // The body this command stored: a RequestView, the first time or replayed.
    return response.body as RequestView;
  }

  async #unblock(
    tx: Transaction,
    actor: StaffReader,
    customerId: string,
    now: Date,
  ): Promise<void> {
    const change = { actorId: actor.memberId, requestId: actor.requestId, now };
    await this.#deps.accountStatus.unblock(tx, { ...change, holderId: customerId });
    await this.#deps.access.restore(tx, { userId: customerId, now });
  }
}
