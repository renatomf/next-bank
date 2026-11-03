import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { Transaction } from '../../../shared/application/ports.ts';
import { ApprovalRequest, type Reason } from '../domain/approval-request.ts';
import { AccountNotBlocked, RequestAlreadyOpen } from '../domain/errors.ts';
import type { StaffReader } from './ports.ts';
import {
  type CommandDependencies,
  customerFor,
  requestEvent,
  type RequestView,
  viewOf,
} from './staff-commands.ts';

/**
 * Opens the request to unblock a customer's account (v1.3.0 plan, B6):
 * someone else decides it. The account is locked while it is checked, so two
 * requests for the same account, or a request and a decision, never cross.
 */
export class RequestUnblock {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: { customerId: string; reason: Reason; note: string | null; idempotencyKey: string },
  ): Promise<RequestView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.request',
          payload: { customerId: input.customerId, reason: input.reason, note: input.note },
          now,
        },
        async () => {
          const customer = await customerFor(this.#deps, tx, actor, input.customerId);
          const status = await this.#deps.accountStatus.lockStatus(tx, customer.id);
          if (status !== 'BLOCKED') throw new AccountNotBlocked();
          if (await repositories.requests.hasPending(customer.id, 'UNBLOCK_ACCOUNT', now)) {
            throw new RequestAlreadyOpen();
          }
          const request = ApprovalRequest.open({
            id: this.#deps.ids.next(),
            kind: 'UNBLOCK_ACCOUNT',
            customerId: customer.id,
            transferId: null,
            reason: input.reason,
            note: input.note,
            requestedBy: actor.memberId,
            // A demo customer's request is one the demo staff may see (STF-11).
            demoScope: await this.#isDemoCustomer(tx, customer.id),
            now,
          });
          await repositories.requests.insert(request.state);
          await repositories.audit.record(
            requestEvent(this.#deps, actor, request.state, 'REQUEST_CREATED', now),
          );
          return { status: 201, body: await viewOf(this.#deps, tx, request.state, now) };
        },
      );
    });
    // The body this command stored: a RequestView, the first time or replayed.
    return response.body as RequestView;
  }

  async #isDemoCustomer(tx: Transaction, id: string): Promise<boolean> {
    return (await this.#deps.customers.find(tx, id, { onlyDemo: true })) !== null;
  }
}
