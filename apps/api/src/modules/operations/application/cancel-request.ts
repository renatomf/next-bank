import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { StaffReader } from './ports.ts';
import {
  type CommandDependencies,
  lockedRequestFor,
  requestEvent,
  type RequestView,
  viewOf,
} from './staff-commands.ts';

/** The requester withdraws a pending request (v1.3.0 plan, B6); nobody else may. */
export class CancelRequest {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: { requestId: string; idempotencyKey: string },
  ): Promise<RequestView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.cancel',
          payload: { requestId: input.requestId },
          now,
        },
        async () => {
          const request = await lockedRequestFor(this.#deps, tx, actor, input.requestId);
          request.cancel(actor.memberId, now);
          await repositories.requests.insertDecision(request.state);
          await repositories.audit.record(
            requestEvent(this.#deps, actor, request.state, 'REQUEST_CANCELLED', now),
          );
          return { status: 200, body: await viewOf(this.#deps, tx, request.state, now) };
        },
      );
    });
    // The body this command stored: a RequestView, the first time or replayed.
    return response.body as RequestView;
  }
}
