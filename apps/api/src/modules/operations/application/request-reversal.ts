import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { Transaction } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import {
  ApprovalRequest,
  type ApprovalRequestState,
  type Reason,
} from '../domain/approval-request.ts';
import { PayeeInsufficientFunds, PixNotReversible, RequestAlreadyOpen } from '../domain/errors.ts';
import { scopeOf } from './customer-reads.ts';
import type { CompletedPix, CustomerRecord, StaffReader } from './ports.ts';
import {
  type CommandDependencies,
  requestEvent,
  type RequestView,
  viewOf,
} from './staff-commands.ts';

/** The Pix and both of its customers, as the member may see them. */
interface ReversiblePix {
  pix: CompletedPix & { payeeAccountId: string };
  payer: CustomerRecord;
  payee: CustomerRecord;
}

/**
 * A completed internal Pix not yet reversed, with both of its customers in
 * the member's scope (v1.3.0 plan, task 5; B7, PIX-14, STF-11). A Pix the
 * member may not see answers as one that does not exist.
 */
async function reversibleFor(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  transferId: string,
): Promise<ReversiblePix> {
  const pix = await deps.transfers.pixById(tx, transferId);
  if (!pix) throw new NotFound('Pix');
  const payerId = await deps.accounts.holderOfAccount(tx, pix.payerAccountId);
  const payeeId =
    pix.payeeAccountId && (await deps.accounts.holderOfAccount(tx, pix.payeeAccountId));
  const scope = scopeOf(actor);
  const payer = payerId ? await deps.customers.find(tx, payerId, scope) : null;
  if (!payer) throw new NotFound('Pix');
  const payee = payeeId ? await deps.customers.find(tx, payeeId, scope) : null;
  if (pix.payeeAccountId && !payee) throw new NotFound('Pix');
  if (!payee || !pix.payeeAccountId || pix.status !== 'COMPLETED') throw new PixNotReversible();
  if (await deps.reversals.isReversed(tx, pix.id)) throw new PixNotReversible();
  return { pix: { ...pix, payeeAccountId: pix.payeeAccountId }, payer, payee };
}

/**
 * Runs an approved reversal (B7): the payee gives the Pix's own amount back,
 * in a new ledger entry, once. A payee without the money moves nothing and
 * leaves the request pending (V1). Blocked accounts are reversed too: the
 * block stops the customer, not the staff's correction (V2).
 */
export async function reversePix(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  request: ApprovalRequestState,
  now: Date,
): Promise<void> {
  if (!request.transferId) throw new Error(`Request ${request.id} names no Pix`);
  const { pix, payer, payee } = await reversibleFor(deps, tx, actor, request.transferId);
  const outcome = await deps.reversals.reverse(tx, {
    transferId: pix.id,
    payerAccountId: pix.payerAccountId,
    payeeAccountId: pix.payeeAccountId,
    amount: pix.amount,
    payer: { name: payer.name, documentMasked: payer.cpfMasked },
    payee: { name: payee.name, documentMasked: payee.cpfMasked },
  });
  if (outcome === 'PAYEE_WITHOUT_FUNDS') throw new PayeeInsufficientFunds();
  await deps.repositories.for(tx).audit.record({
    id: deps.ids.next(),
    occurredAt: now,
    actorType: 'STAFF',
    actorId: actor.memberId,
    action: 'PIX_REVERSED',
    subjectType: 'PIX_TRANSFER',
    subjectId: pix.id,
    requestId: actor.requestId,
    metadata: { approvalRequestId: request.id, payerId: payer.id, payeeId: payee.id },
  });
}

/**
 * Opens the request to reverse a Pix (v1.3.0 plan, task 5): someone else
 * approves it. The payer's account is locked while it is checked, so two
 * requests for the same Pix never cross. The request names the Pix and its
 * payer, never an amount (PIX-14).
 */
export class RequestReversal {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: { transferId: string; reason: Reason; note: string | null; idempotencyKey: string },
  ): Promise<RequestView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.reversal',
          payload: { transferId: input.transferId, reason: input.reason, note: input.note },
          now,
        },
        async () => {
          const { payer, payee } = await reversibleFor(this.#deps, tx, actor, input.transferId);
          await this.#deps.accountStatus.lockStatus(tx, payer.id);
          if (await repositories.requests.hasPendingForTransfer(input.transferId, now)) {
            throw new RequestAlreadyOpen();
          }
          const demo = { onlyDemo: true };
          const request = ApprovalRequest.open({
            id: this.#deps.ids.next(),
            kind: 'REVERSE_PIX',
            customerId: payer.id,
            transferId: input.transferId,
            reason: input.reason,
            note: input.note,
            requestedBy: actor.memberId,
            // Only when both customers are demo ones may the demo staff see it (STF-11).
            demoScope:
              (await this.#deps.customers.find(tx, payer.id, demo)) !== null &&
              (await this.#deps.customers.find(tx, payee.id, demo)) !== null,
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
}
