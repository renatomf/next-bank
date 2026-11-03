import { Idempotency } from '../../../shared/application/idempotency.ts';
import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import {
  ApprovalRequest,
  type ApprovalRequestState,
  type Reason,
} from '../domain/approval-request.ts';
import { ExceptionNotOpen, PixNoLongerProcessing } from '../domain/errors.ts';
import {
  type ExceptionKind,
  type ExceptionState,
  type Outcome,
  ReconciliationException,
  type Resolution,
  type ResolutionState,
} from '../domain/reconciliation-exception.ts';
import { scopeOf } from './customer-reads.ts';
import type { CompletedPix, CustomerRecord, ExceptionPosition, StaffReader } from './ports.ts';
import {
  type CommandDependencies,
  requestEvent,
  type RequestView,
  viewOf,
} from './staff-commands.ts';

const PAGE_SIZE = 20;

interface MoneyView {
  amount: number;
  currency: 'BRL';
}

interface Person {
  id: string;
  name: string;
}

/** An exception as the staff reads it, ready for JSON: also what an idempotent replay returns. */
export interface ExceptionView {
  id: string;
  runDate: string;
  kind: ExceptionKind;
  endToEndId: string | null;
  expected: MoneyView | null;
  actual: MoneyView | null;
  detectedAt: string;
  status: 'OPEN' | 'RESOLVED';
  /** next bank's Pix and its payer; none for the clearing balance or a Pix not here. */
  pix: { id: string; amount: MoneyView; status: string; customer: Person } | null;
  /** The request to settle or refund it, while one is pending. */
  pendingRequestId: string | null;
  resolution: {
    outcome: Outcome;
    resolvedBy: Person;
    resolvedAt: string;
    explanation: string | null;
    approvalRequestId: string | null;
  } | null;
}

export interface ExceptionsPage {
  items: ExceptionView[];
  next: ExceptionPosition | null;
}

/** An exception with its Pix here and that Pix's payer. */
interface ExceptionCase {
  state: ExceptionState;
  pix: CompletedPix | null;
  payer: CustomerRecord | null;
}

const moneyView = (money: Money): MoneyView => ({
  amount: money.toJsonAmount(),
  currency: 'BRL',
});

/**
 * The Pix of each exception and its payer, keeping only what the member may
 * see (X5, STF-11): an exception about a Pix here goes with its payer; the
 * clearing balance, which is no single Pix, is everyone's; one about a Pix
 * next bank does not have names no customer, so the demo staff never sees it.
 */
async function casesFor(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  exceptions: ExceptionState[],
): Promise<ExceptionCase[]> {
  const pixes = await deps.transfers.pixByEndToEndIds(
    tx,
    exceptions.flatMap((exception) => (exception.endToEndId ? [exception.endToEndId] : [])),
  );
  const holders = await deps.accounts.holdersOfAccounts(tx, [
    ...new Set(pixes.map((pix) => pix.payerAccountId)),
  ]);
  const payers = await deps.customers.findMany(tx, [...new Set(holders.values())], scopeOf(actor));
  return exceptions.flatMap((state) => {
    const pix = pixes.find((found) => found.endToEndId === state.endToEndId) ?? null;
    const holder = pix && holders.get(pix.payerAccountId);
    const payer = payers.find((customer) => customer.id === holder) ?? null;
    if (state.endToEndId === null) return [{ state, pix: null, payer: null }];
    if (pix ? payer === null : actor.isDemo) return [];
    return [{ state, pix, payer }];
  });
}

/** One exception the member may see, locked or not; NotFound otherwise. */
async function caseFor(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  exceptionId: string,
  lock: boolean,
): Promise<ExceptionCase> {
  const state = lock
    ? await deps.exceptions.lockException(tx, exceptionId)
    : await deps.exceptions.exceptionById(tx, exceptionId);
  const [found] = state ? await casesFor(deps, tx, actor, [state]) : [];
  if (!found) throw new NotFound('Exception');
  return found;
}

async function viewsOf(
  deps: CommandDependencies,
  tx: Transaction,
  cases: ExceptionCase[],
  now: Date,
): Promise<ExceptionView[]> {
  const pending = await deps.repositories.for(tx).requests.pendingForExceptions(
    cases.map(({ state }) => state.id),
    now,
  );
  const staff = await deps.staffNames.namesOf(tx, [
    ...new Set(cases.flatMap(({ state }) => state.resolution?.resolvedBy ?? [])),
  ]);
  return cases.map(({ state, pix, payer }) => ({
    id: state.id,
    runDate: state.runDate,
    kind: state.kind,
    endToEndId: state.endToEndId,
    expected: state.expected && moneyView(state.expected),
    actual: state.actual && moneyView(state.actual),
    detectedAt: state.detectedAt.toISOString(),
    status: state.resolution ? 'RESOLVED' : 'OPEN',
    pix:
      pix && payer
        ? {
            id: pix.id,
            amount: moneyView(pix.amount),
            status: pix.status,
            customer: { id: payer.id, name: payer.name },
          }
        : null,
    pendingRequestId: pending.get(state.id) ?? null,
    resolution: state.resolution && {
      outcome: state.resolution.outcome,
      resolvedBy: {
        id: state.resolution.resolvedBy,
        name: staff.get(state.resolution.resolvedBy) ?? '',
      },
      resolvedAt: state.resolution.resolvedAt.toISOString(),
      explanation: state.resolution.explanation,
      approvalRequestId: state.resolution.approvalRequestId,
    },
  }));
}

/** The exception resolved, by the member who resolved it; the explanation never (API-04). */
function resolvedEvent(
  deps: CommandDependencies,
  actor: StaffReader,
  exception: ExceptionState,
  resolution: ResolutionState,
  now: Date,
) {
  return {
    id: deps.ids.next(),
    occurredAt: now,
    actorType: 'STAFF' as const,
    actorId: actor.memberId,
    action: 'EXCEPTION_RESOLVED',
    subjectType: 'RECONCILIATION_EXCEPTION',
    subjectId: exception.id,
    requestId: actor.requestId,
    metadata: {
      kind: exception.kind,
      outcome: resolution.outcome,
      ...(resolution.approvalRequestId ? { approvalRequestId: resolution.approvalRequestId } : {}),
    },
  };
}

/**
 * Runs an approved resolution (v1.3.0 plan, task 6; X4, REC-01): the Pix
 * ends as the SPI's answer would, through Payments' own path and locks, and
 * the exception is resolved in the same transaction. A Pix the SPI already
 * answered moves nothing, and the request stays pending.
 */
export async function concludeException(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  request: ApprovalRequestState,
  now: Date,
): Promise<void> {
  const { exceptionId, resolution } = request;
  if (!exceptionId || !resolution) throw new Error(`Request ${request.id} names no exception`);
  const state = await deps.exceptions.lockException(tx, exceptionId);
  if (!state?.endToEndId) throw new Error(`Request ${request.id} names no Pix to conclude`);
  const exception = ReconciliationException.restore(state);
  exception.resolve(resolution, request.id, actor.memberId, now);
  const applied = await deps.stalePix.concludeWaitingPix(tx, {
    endToEndId: state.endToEndId,
    outcome: resolution === 'SETTLE' ? 'SETTLED' : 'REJECTED',
    actorId: actor.memberId,
    requestId: actor.requestId,
  });
  if (applied === 'NOT_WAITING') throw new PixNoLongerProcessing();
  const resolved = exception.state;
  if (!resolved.resolution) throw new Error(`Exception ${state.id} was not resolved`);
  await deps.exceptions.recordResolution(tx, resolved.resolution);
  await deps.repositories
    .for(tx)
    .audit.record(resolvedEvent(deps, actor, resolved, resolved.resolution, now));
}

/**
 * Opens the request to settle or refund a Pix left waiting for the SPI
 * (v1.3.0 plan, task 6; X1, X3): someone else approves it. The exception is
 * locked while it is checked, so a request and an explanation never cross,
 * and the Pix must still be waiting (X4). The request belongs to the payer.
 */
export class RequestResolution {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: {
      exceptionId: string;
      resolution: Resolution;
      reason: Reason;
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
          operation: 'staff.exception',
          payload: {
            exceptionId: input.exceptionId,
            resolution: input.resolution,
            reason: input.reason,
            note: input.note,
          },
          now,
        },
        async () => {
          const { state, pix, payer } = await caseFor(
            this.#deps,
            tx,
            actor,
            input.exceptionId,
            true,
          );
          ReconciliationException.restore(state).assertSettleable();
          const pending = await repositories.requests.pendingForExceptions([state.id], now);
          if (pending.has(state.id)) throw new ExceptionNotOpen();
          if (!pix || !payer || pix.status !== 'PROCESSING') throw new PixNoLongerProcessing();
          const request = ApprovalRequest.open({
            id: this.#deps.ids.next(),
            kind: 'RESOLVE_EXCEPTION',
            customerId: payer.id,
            transferId: null,
            exception: { id: state.id, resolution: input.resolution },
            reason: input.reason,
            note: input.note,
            requestedBy: actor.memberId,
            // Only when the payer is a demo customer may the demo staff see it (STF-11).
            demoScope: (await this.#deps.customers.find(tx, payer.id, { onlyDemo: true })) !== null,
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

/**
 * Resolves an exception that needs nothing more, by the analyst alone, at
 * once (v1.3.0 plan, task 6; X2): no money moves. The exception is locked,
 * and one with a request pending waits for that request's decision.
 */
export class ExplainException {
  readonly #deps: CommandDependencies;
  readonly #idempotency: Idempotency;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
    this.#idempotency = new Idempotency(deps.fingerprint);
  }

  async execute(
    actor: StaffReader,
    input: { exceptionId: string; explanation: string; idempotencyKey: string },
  ): Promise<ExceptionView> {
    const now = this.#deps.clock.now();
    const response = await this.#deps.unitOfWork.run((tx) => {
      const repositories = this.#deps.repositories.for(tx);
      return this.#idempotency.run(
        repositories.idempotency,
        {
          userId: actor.memberId,
          key: input.idempotencyKey,
          operation: 'staff.explain',
          payload: { exceptionId: input.exceptionId, explanation: input.explanation },
          now,
        },
        async () => {
          const found = await caseFor(this.#deps, tx, actor, input.exceptionId, true);
          const pending = await repositories.requests.pendingForExceptions([found.state.id], now);
          if (pending.has(found.state.id)) throw new ExceptionNotOpen();
          const exception = ReconciliationException.restore(found.state);
          exception.explain(input.explanation, actor.memberId, now);
          const resolved = exception.state;
          if (!resolved.resolution) throw new Error(`Exception ${resolved.id} was not explained`);
          await this.#deps.exceptions.recordResolution(tx, resolved.resolution);
          await repositories.audit.record(
            resolvedEvent(this.#deps, actor, resolved, resolved.resolution, now),
          );
          const [view] = await viewsOf(this.#deps, tx, [{ ...found, state: resolved }], now);
          return { status: 200, body: view };
        },
      );
    });
    // The body this command stored: an ExceptionView, the first time or replayed.
    return response.body as ExceptionView;
  }
}

/**
 * The exceptions queue (v1.3.0 plan, task 6): newest first, open only or all
 * of them, a page at a time. The demo staff's page leaves out what it may
 * not see (X5), so it may come shorter.
 */
export class ListExceptions {
  readonly #deps: CommandDependencies;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
  }

  execute(
    actor: StaffReader,
    input: { status: 'OPEN' | 'ALL'; after: ExceptionPosition | null },
  ): Promise<ExceptionsPage> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const found = await this.#deps.exceptions.exceptionsPage(tx, {
        status: input.status,
        after: input.after,
        limit: PAGE_SIZE + 1,
      });
      const page = found.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      const cases = await casesFor(this.#deps, tx, actor, page);
      return {
        items: await viewsOf(this.#deps, tx, cases, now),
        next:
          found.length > PAGE_SIZE && last ? { detectedAt: last.detectedAt, id: last.id } : null,
      };
    });
  }
}

/** One exception, with its Pix and payer; NotFound outside the demo staff's scope (X5). */
export class GetException {
  readonly #deps: CommandDependencies;

  constructor(deps: CommandDependencies) {
    this.#deps = deps;
  }

  execute(actor: StaffReader, exceptionId: string): Promise<ExceptionView> {
    const now = this.#deps.clock.now();
    return this.#deps.unitOfWork.run(async (tx) => {
      const found = await caseFor(this.#deps, tx, actor, exceptionId, false);
      const [view] = await viewsOf(this.#deps, tx, [found], now);
      if (!view) throw new Error(`Exception ${exceptionId} has no view`);
      return view;
    });
  }
}
