import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { Reason } from '../domain/approval-request.ts';
import { DemoCustomerProtected } from '../domain/errors.ts';
import type { StaffReader } from './ports.ts';
import { type CommandDependencies, customerFor } from './staff-commands.ts';

/**
 * Blocks a customer's account at once, by one person: it protects, it moves
 * no money (v1.3.0 plan, B6). The account turns BLOCKED and the customer
 * LOCKED, with every session revoked, in one transaction (K1, F-12). The
 * demo staff never blocks the app's shared customers (K5, STF-13).
 */
export class BlockAccount {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: { customerId: string; reason: Reason; idempotencyKey: string },
  ): Promise<void> {
    const now = this.#deps.clock.now();
    await this.#deps.unitOfWork.run((tx) =>
      this.#idempotency.run(
        this.#deps.repositories.for(tx).idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.block',
          payload: { customerId: input.customerId, reason: input.reason },
          now,
        },
        async () => {
          const customer = await customerFor(this.#deps, tx, actor, input.customerId);
          if (actor.isDemo && customer.demoProtected) throw new DemoCustomerProtected();
          const change = { actorId: actor.memberId, requestId: actor.requestId, now };
          // Account first, then the customer and the sessions: the order every
          // command that touches both follows (database.md 7).
          await this.#deps.accountStatus.block(tx, {
            ...change,
            holderId: customer.id,
            reason: input.reason,
          });
          await this.#deps.access.lockOut(tx, { ...change, userId: customer.id });
          return { status: 204, body: null };
        },
      ),
    );
  }
}
