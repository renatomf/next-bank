import type { Money } from '../../../shared/domain/money.ts';
import { ExceptionNotOpen, ExceptionNotSettleable, InvalidExplanation } from './errors.ts';

export type ExceptionKind =
  | 'MISSING_HERE'
  | 'MISSING_AT_SPI'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'STALE_PROCESSING'
  | 'CLEARING_MISMATCH';

/** How the staff ends a Pix left waiting for the SPI, as the SPI's answer would (X1). */
export const RESOLUTIONS = ['SETTLE', 'REFUND'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export type Outcome = 'SETTLED' | 'REFUNDED' | 'EXPLAINED';

export interface ResolutionState {
  exceptionId: string;
  outcome: Outcome;
  /** The approved request that settled or refunded; none for an explanation. */
  approvalRequestId: string | null;
  /** Why it needs nothing more; only an explanation has one, never audited (API-04). */
  explanation: string | null;
  resolvedBy: string;
  resolvedAt: Date;
}

export interface ExceptionState {
  id: string;
  /** The day of São Paulo the reconciliation compared (`YYYY-MM-DD`). */
  runDate: string;
  kind: ExceptionKind;
  /** Null only for the clearing balance, which is no single Pix. */
  endToEndId: string | null;
  expected: Money | null;
  actual: Money | null;
  detectedAt: Date;
  resolution: ResolutionState | null;
}

const SHORTEST_EXPLANATION = 10;
const LONGEST_EXPLANATION = 500;

/**
 * A divergence the daily reconciliation found, as the staff resolves it
 * (v1.3.0 plan, task 6; ADR 0018, D7). The exception itself never changes
 * (R5); it is resolved once, in a record of its own. Only a Pix left waiting
 * for the SPI is settled or refunded (X1); any exception may be explained,
 * moving no money (X2).
 */
export class ReconciliationException {
  #state: ExceptionState;

  private constructor(state: ExceptionState) {
    this.#state = { ...state };
  }

  static restore(state: ExceptionState): ReconciliationException {
    return new ReconciliationException(state);
  }

  get state(): ExceptionState {
    return { ...this.#state };
  }

  get isOpen(): boolean {
    return this.#state.resolution === null;
  }

  assertSettleable(): void {
    this.#assertOpen();
    if (this.#state.kind !== 'STALE_PROCESSING') throw new ExceptionNotSettleable();
  }

  resolve(resolution: Resolution, approvalRequestId: string, by: string, now: Date): void {
    this.assertSettleable();
    this.#state.resolution = {
      exceptionId: this.#state.id,
      outcome: resolution === 'SETTLE' ? 'SETTLED' : 'REFUNDED',
      approvalRequestId,
      explanation: null,
      resolvedBy: by,
      resolvedAt: now,
    };
  }

  explain(explanation: string, by: string, now: Date): void {
    this.#assertOpen();
    const trimmed = explanation.trim();
    if (trimmed.length < SHORTEST_EXPLANATION || trimmed.length > LONGEST_EXPLANATION) {
      throw new InvalidExplanation();
    }
    this.#state.resolution = {
      exceptionId: this.#state.id,
      outcome: 'EXPLAINED',
      approvalRequestId: null,
      explanation: trimmed,
      resolvedBy: by,
      resolvedAt: now,
    };
  }

  #assertOpen(): void {
    if (!this.isOpen) throw new ExceptionNotOpen();
  }
}
