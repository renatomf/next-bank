import type {
  Clock,
  IdGenerator,
  Transaction,
  UnitOfWork,
} from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { type AuthorizationRefusal, PixAuthorizationRefused } from '../domain/errors.ts';
import {
  Idempotency,
  type RequestFingerprint,
  type StoredResponse,
} from '../../../shared/application/idempotency.ts';
import { PixTransfer } from '../domain/pix-transfer.ts';
import { type PixTransferView, viewOf } from './pix-transfer-view.ts';
import type { PaymentsRepositories, PaymentsRepositoriesFactory } from './ports.ts';
import { processPix, type ProcessPixDependencies } from './process-pix.ts';

export interface AuthorizePixTransferInput {
  /** From the verified access token: the payer is never taken from the request (PIX-01). */
  userId: string;
  sessionId: string;
  transferId: string;
  idempotencyKey: string;
  pin: string;
  requestId: string | null;
}

export interface AuthorizePixTransferDependencies extends ProcessPixDependencies {
  unitOfWork: UnitOfWork;
  repositories: PaymentsRepositoriesFactory;
  fingerprint: RequestFingerprint;
  clock: Clock;
  ids: IdGenerator;
}

/** Status of a stored refusal: what was recorded is answered as the catalog error. */
const REFUSED = 0;

interface Refusal {
  code: AuthorizationRefusal;
  details: Record<string, number>;
}

/**
 * Authorizes a Pix with the PIN checked on the server (ADR 0004), once per
 * idempotency key (ADR 0007), in one transaction with the locks in the order
 * of database.md section 7: the Pix, the PIN, the accounts for share and the
 * ledger accounts by id. The checks of balance, limit and accounts made here
 * are the ones that count (domain-model.md 4).
 */
export class AuthorizePixTransfer {
  readonly #deps: AuthorizePixTransferDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: AuthorizePixTransferDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(input: AuthorizePixTransferInput): Promise<PixTransferView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: input.userId,
          key: input.idempotencyKey,
          operation: 'pix.authorize',
          // Never the PIN (D4): the same key with another PIN gets the first answer.
          payload: { transferId: input.transferId },
          now,
        },
        () => this.#authorize(tx, repositories, input, now),
      );
    });
    // Committed already: a refusal is answered only after what changed is saved.
    if (response.status === REFUSED) {
      const refusal = response.body as Refusal;
      throw new PixAuthorizationRefused(refusal.code, refusal.details);
    }
    return response.body as PixTransferView;
  }

  async #authorize(
    tx: Transaction,
    repositories: PaymentsRepositories,
    input: AuthorizePixTransferInput,
    now: Date,
  ): Promise<StoredResponse> {
    const { accounts, identity } = this.#deps;
    const payer = await accounts.findByHolder(tx, input.userId);
    const state =
      payer && (await repositories.pixTransfers.lockForPayer(input.transferId, payer.id));
    if (!payer || !state) throw new NotFound('Pix transfer');
    const transfer = PixTransfer.restore(state);
    // Settled already (PIX-08): nothing changes, so nothing is stored either.
    transfer.assertAwaitingAuthorization();

    if (transfer.isExpired(now)) {
      return this.#cancel(repositories, transfer, input, now, 'EXPIRED', 'TransferExpired');
    }

    const pin = await identity.verifyPin(tx, {
      userId: input.userId,
      pin: input.pin,
      requestId: input.requestId,
    });
    switch (pin.outcome) {
      case 'INCORRECT':
        return refused('PinIncorrect', { remainingAttempts: pin.remainingAttempts });
      case 'LOCKED':
        return this.#cancel(repositories, transfer, input, now, 'PIN_LOCKED', 'PinLocked');
      case 'RESET_REQUIRED':
        return this.#cancel(repositories, transfer, input, now, 'PIN_LOCKED', 'PinResetRequired');
      case 'VERIFIED':
        break;
    }

    await processPix(this.#deps, tx, transfer, payer, now, input.requestId);
    await repositories.pixTransfers.update(transfer.state);
    await this.#record(repositories, transfer, input, now);
    return { status: 200, body: viewOf(transfer.state) };
  }

  async #cancel(
    repositories: PaymentsRepositories,
    transfer: PixTransfer,
    input: AuthorizePixTransferInput,
    now: Date,
    reason: 'EXPIRED' | 'PIN_LOCKED',
    refusal: AuthorizationRefusal,
  ): Promise<StoredResponse> {
    transfer.cancel(now);
    await repositories.pixTransfers.update(transfer.state);
    await repositories.audit.record({
      id: this.#deps.ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.userId,
      action: 'PIX_CANCELLED',
      subjectType: 'PIX_TRANSFER',
      subjectId: transfer.state.id,
      requestId: input.requestId,
      metadata: { sessionId: input.sessionId, reason },
    });
    return refused(refusal);
  }

  /** PIX-09: the trail ties the outcome to the session and the request. */
  async #record(
    repositories: PaymentsRepositories,
    transfer: PixTransfer,
    input: AuthorizePixTransferInput,
    now: Date,
  ): Promise<void> {
    const { state } = transfer;
    const failed = state.status === 'FAILED';
    await repositories.audit.record({
      id: this.#deps.ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.userId,
      // Sent: on its way to another bank, which answers later (task 4).
      action: failed ? 'PIX_FAILED' : state.status === 'COMPLETED' ? 'PIX_COMPLETED' : 'PIX_SENT',
      subjectType: 'PIX_TRANSFER',
      subjectId: state.id,
      requestId: input.requestId,
      metadata: !failed
        ? {
            sessionId: input.sessionId,
            amountCents: state.amount.toJsonAmount(),
            endToEndId: state.endToEndId ?? '',
          }
        : { sessionId: input.sessionId, reason: state.failureReason ?? '' },
    });
  }
}

function refused(code: AuthorizationRefusal, details: Record<string, number> = {}): StoredResponse {
  return { status: REFUSED, body: { code, details } satisfies Refusal };
}
