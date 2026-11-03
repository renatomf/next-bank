import type { RequestFingerprint } from '../../../shared/application/idempotency.ts';
import type { Transaction } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import {
  ApprovalRequest,
  type ApprovalRequestState,
  type Decision,
  type Reason,
  type RequestKind,
  type RequestStatus,
} from '../domain/approval-request.ts';
import { type CustomerReadsDependencies, scopeOf } from './customer-reads.ts';
import type {
  AccountStatusPort,
  CustomerAccessPort,
  CustomerRecord,
  OperationsRepositoriesFactory,
  PixReversalsPort,
  PixTransfersPort,
  StaffNamesPort,
  StaffReader,
} from './ports.ts';

/** What the staff's commands need, besides what the reads do (v1.3.0, task 4). */
export interface CommandDependencies extends CustomerReadsDependencies {
  accountStatus: AccountStatusPort;
  access: CustomerAccessPort;
  staffNames: StaffNamesPort;
  repositories: OperationsRepositoriesFactory;
  /** Keyed hash of each command, for its idempotency record (ADR 0015). */
  fingerprint: RequestFingerprint;
  transfers: PixTransfersPort;
  reversals: PixReversalsPort;
}

interface Person {
  id: string;
  name: string;
}

/** A request as the staff reads it, ready for JSON: also what an idempotent replay returns. */
export interface RequestView {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  customer: Person;
  /** The Pix a reversal reverses, with its own amount (PIX-14); none for an unblock. */
  transfer: {
    id: string;
    amount: { amount: number; currency: 'BRL' };
    payeeName: string;
  } | null;
  reason: Reason;
  note: string | null;
  requestedBy: Person;
  requestedAt: string;
  expiresAt: string;
  decision: {
    decision: Decision;
    decidedBy: Person;
    decidedAt: string;
    note: string | null;
  } | null;
}

/** The customer a member may act on, or NotFound: the demo staff's scope included (STF-11). */
export async function customerFor(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  customerId: string,
): Promise<CustomerRecord> {
  const customer = await deps.customers.find(tx, customerId, scopeOf(actor));
  if (!customer) throw new NotFound('Customer');
  return customer;
}

/** A request the member may see, locked for a decision; NotFound outside the scope. */
export async function lockedRequestFor(
  deps: CommandDependencies,
  tx: Transaction,
  actor: StaffReader,
  requestId: string,
): Promise<ApprovalRequest> {
  const state = await deps.repositories.for(tx).requests.lock(requestId);
  if (!state || (actor.isDemo && !state.demoScope)) throw new NotFound('Request');
  return ApprovalRequest.restore(state);
}

/** The views of [requests], with the names of the customers and the staff in one read each. */
export async function viewsOf(
  deps: CommandDependencies,
  tx: Transaction,
  requests: ApprovalRequestState[],
  now: Date,
): Promise<RequestView[]> {
  const customers = await deps.customers.findMany(
    tx,
    [...new Set(requests.map((request) => request.customerId))],
    { onlyDemo: false },
  );
  const staff = await deps.staffNames.namesOf(tx, [
    ...new Set(
      requests.flatMap((request) =>
        request.decision
          ? [request.requestedBy, request.decision.decidedBy]
          : [request.requestedBy],
      ),
    ),
  ]);
  const transfers = await deps.transfers.pixByIds(
    tx,
    requests.flatMap((request) => (request.transferId ? [request.transferId] : [])),
  );
  const transferOf = (id: string | null) => {
    const pix = transfers.find((transfer) => transfer.id === id);
    return pix
      ? {
          id: pix.id,
          amount: { amount: pix.amount.toJsonAmount(), currency: 'BRL' as const },
          payeeName: pix.payee.name,
        }
      : null;
  };
  const customerName = (id: string) => customers.find((customer) => customer.id === id)?.name ?? '';
  const person = (id: string) => ({ id, name: staff.get(id) ?? '' });
  return requests.map((state) => ({
    id: state.id,
    kind: state.kind,
    status: ApprovalRequest.restore(state).statusAt(now),
    customer: { id: state.customerId, name: customerName(state.customerId) },
    transfer: transferOf(state.transferId),
    reason: state.reason,
    note: state.note,
    requestedBy: person(state.requestedBy),
    requestedAt: state.requestedAt.toISOString(),
    expiresAt: state.expiresAt.toISOString(),
    decision: state.decision && {
      decision: state.decision.decision,
      decidedBy: person(state.decision.decidedBy),
      decidedAt: state.decision.decidedAt.toISOString(),
      note: state.decision.note,
    },
  }));
}

/** The view of one request. */
export async function viewOf(
  deps: CommandDependencies,
  tx: Transaction,
  request: ApprovalRequestState,
  now: Date,
): Promise<RequestView> {
  const [view] = await viewsOf(deps, tx, [request], now);
  if (!view) throw new Error(`Request ${request.id} has no view`);
  return view;
}

/** An event about a request, by the member who acted. */
export function requestEvent(
  deps: CommandDependencies,
  actor: StaffReader,
  request: ApprovalRequestState,
  action: string,
  now: Date,
) {
  return {
    id: deps.ids.next(),
    occurredAt: now,
    actorType: 'STAFF' as const,
    actorId: actor.memberId,
    action,
    subjectType: 'APPROVAL_REQUEST',
    subjectId: request.id,
    requestId: actor.requestId,
    metadata: {
      kind: request.kind,
      customerId: request.customerId,
      reason: request.reason,
      ...(request.transferId ? { transferId: request.transferId } : {}),
    },
  };
}
