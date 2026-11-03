import {
  InvalidRequestNote,
  NotTheRequester,
  RequestNotPending,
  SelfApprovalNotAllowed,
} from './errors.ts';
import type { Resolution } from './reconciliation-exception.ts';

export const REQUEST_KINDS = ['UNBLOCK_ACCOUNT', 'REVERSE_PIX', 'RESOLVE_EXCEPTION'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** Why the staff acts; a code, never free text, so the audit holds no personal data. */
export const REASONS = ['FRAUD_SUSPECTED', 'CUSTOMER_REQUEST', 'LEGAL_ORDER', 'OTHER'] as const;
export type Reason = (typeof REASONS)[number];

export type Decision = 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RequestStatus = 'PENDING' | 'EXPIRED' | Decision;

export interface DecisionState {
  decision: Decision;
  decidedBy: string;
  decidedAt: Date;
  note: string | null;
}

export interface ApprovalRequestState {
  id: string;
  kind: RequestKind;
  customerId: string;
  /** The Pix a reversal reverses (v1.3.0, task 5); none for an unblock. */
  transferId: string | null;
  reason: Reason;
  note: string | null;
  requestedBy: string;
  requestedAt: Date;
  expiresAt: Date;
  /** About a demo customer: the only requests the demo staff sees (STF-11). */
  demoScope: boolean;
  /** The exception a resolution resolves, and how (v1.3.0, task 6); none for the others. */
  exceptionId: string | null;
  resolution: Resolution | null;
  decision: DecisionState | null;
}

const VALIDITY_MS = 24 * 60 * 60_000;
const LONGEST_NOTE = 500;

/**
 * A command that needs two people (v1.3.0 plan, B6; domain-model.md,
 * Operations): one opens it, another approves or rejects it, and only who
 * opened it may cancel it (STF-03). It is decided once (STF-09), and it
 * expires 24 hours after it was opened, read from the clock, with no job (K4).
 */
export class ApprovalRequest {
  #state: ApprovalRequestState;

  private constructor(state: ApprovalRequestState) {
    this.#state = { ...state };
  }

  static open(input: {
    id: string;
    kind: RequestKind;
    customerId: string;
    transferId: string | null;
    /** Only a request to resolve an exception names one (task 6). */
    exception?: { id: string; resolution: Resolution };
    reason: Reason;
    note: string | null;
    requestedBy: string;
    demoScope: boolean;
    now: Date;
  }): ApprovalRequest {
    // A reversal names its Pix, a resolution its exception, an unblock neither:
    // a bug in the caller otherwise.
    if ((input.kind === 'REVERSE_PIX') !== (input.transferId !== null)) {
      throw new Error(`A ${input.kind} request ${input.transferId ? 'names no' : 'needs its'} Pix`);
    }
    if ((input.kind === 'RESOLVE_EXCEPTION') !== (input.exception !== undefined)) {
      throw new Error(
        `A ${input.kind} request ${input.exception ? 'names no' : 'needs its'} exception`,
      );
    }
    return new ApprovalRequest({
      id: input.id,
      kind: input.kind,
      customerId: input.customerId,
      transferId: input.transferId,
      reason: input.reason,
      note: noteOf(input.note),
      requestedBy: input.requestedBy,
      requestedAt: input.now,
      expiresAt: new Date(input.now.getTime() + VALIDITY_MS),
      demoScope: input.demoScope,
      exceptionId: input.exception?.id ?? null,
      resolution: input.exception?.resolution ?? null,
      decision: null,
    });
  }

  static restore(state: ApprovalRequestState): ApprovalRequest {
    return new ApprovalRequest(state);
  }

  get state(): ApprovalRequestState {
    return { ...this.#state };
  }

  statusAt(now: Date): RequestStatus {
    if (this.#state.decision) return this.#state.decision.decision;
    return now < this.#state.expiresAt ? 'PENDING' : 'EXPIRED';
  }

  approve(by: string, now: Date, note: string | null): void {
    this.#decide('APPROVED', by, now, note);
  }

  reject(by: string, now: Date, note: string | null): void {
    this.#decide('REJECTED', by, now, note);
  }

  cancel(by: string, now: Date): void {
    this.#assertPending(now);
    if (by !== this.#state.requestedBy) throw new NotTheRequester();
    this.#state.decision = { decision: 'CANCELLED', decidedBy: by, decidedAt: now, note: null };
  }

  #decide(decision: 'APPROVED' | 'REJECTED', by: string, now: Date, note: string | null): void {
    this.#assertPending(now);
    if (by === this.#state.requestedBy) throw new SelfApprovalNotAllowed();
    this.#state.decision = { decision, decidedBy: by, decidedAt: now, note: noteOf(note) };
  }

  #assertPending(now: Date): void {
    if (this.statusAt(now) !== 'PENDING') throw new RequestNotPending();
  }
}

function noteOf(note: string | null): string | null {
  const trimmed = note?.trim() ?? '';
  if (trimmed.length > LONGEST_NOTE) throw new InvalidRequestNote();
  return trimmed === '' ? null : trimmed;
}
