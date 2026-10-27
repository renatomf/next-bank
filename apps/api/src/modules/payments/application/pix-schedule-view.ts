import type { PixKeyType } from '../domain/pix-key.ts';
import {
  PixSchedule,
  type PixScheduleState,
  type PixScheduleStatus,
  type ScheduleRecurrence,
} from '../domain/pix-schedule.ts';
import type { PixFailureReason, PixTransferStatus } from '../domain/pix-transfer.ts';
import type { ScheduleOccurrence } from './ports.ts';

/**
 * A schedule as the payer may see it (READ-02): no account id, never the
 * payee's full key or document. Plain JSON, so it can be stored as an
 * idempotent response and sent back unchanged.
 */
export interface PixScheduleView {
  id: string;
  status: PixScheduleStatus;
  amount: { amount: number; currency: 'BRL' };
  description: string | null;
  payee: {
    name: string;
    documentMasked: string;
    keyType: PixKeyType;
    keyMasked: string;
    /** Only for a payee at another bank. */
    bank?: { ispb: string; name: string };
  };
  firstDate: string;
  /** Times is 1 for a Pix scheduled once. */
  recurrence: { frequency: ScheduleRecurrence['frequency']; times: number };
  nextOccurrenceDate: string | null;
  /** The date of the last occurrence: the end the app shows (S2). */
  lastOccurrenceDate: string;
  createdAt: string;
  cancelledAt: string | null;
}

/** A schedule with what each of its occurrences became. */
export interface PixScheduleDetailView extends PixScheduleView {
  occurrences: {
    sequence: number;
    date: string;
    transferId: string;
    status: PixTransferStatus;
    failureReason: PixFailureReason | null;
  }[];
}

export function scheduleViewOf(state: Readonly<PixScheduleState>): PixScheduleView {
  const schedule = PixSchedule.restore(state);
  return {
    id: state.id,
    status: state.status,
    amount: { amount: state.amount.toJsonAmount(), currency: state.amount.currency },
    description: state.description,
    payee: {
      name: state.payee.name,
      documentMasked: state.payee.documentMasked,
      keyType: state.payee.keyType,
      keyMasked: state.payee.keyMasked,
      ...(state.payee.bank ? { bank: { ...state.payee.bank } } : {}),
    },
    firstDate: state.firstDate,
    recurrence: { frequency: state.recurrence.frequency, times: schedule.times },
    nextOccurrenceDate: state.nextOccurrenceDate,
    lastOccurrenceDate: schedule.occurrenceDate(schedule.times),
    createdAt: state.createdAt.toISOString(),
    cancelledAt: state.cancelledAt?.toISOString() ?? null,
  };
}

export function scheduleDetailViewOf(
  state: Readonly<PixScheduleState>,
  occurrences: readonly ScheduleOccurrence[],
): PixScheduleDetailView {
  return {
    ...scheduleViewOf(state),
    occurrences: occurrences.map((occurrence) => ({
      sequence: occurrence.sequence,
      date: occurrence.date,
      transferId: occurrence.transferId,
      status: occurrence.status,
      failureReason: occurrence.failureReason,
    })),
  };
}
