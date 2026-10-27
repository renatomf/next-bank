import type { Money } from '../../../shared/domain/money.ts';
import {
  InvalidAmount,
  InvalidRecurrence,
  LimitExceeded,
  SamePayerAndPayee,
  ScheduleInPast,
  ScheduleNotActive,
} from './errors.ts';
import type { PixPayee } from './pix-transfer.ts';
import { DAYTIME_LIMIT, isDaytime } from './transfer-limits.ts';

const MAX_DESCRIPTION_LENGTH = 140;
const MIN_MONTHLY_TIMES = 2;
const MAX_MONTHLY_TIMES = 24;
const MAX_DAYS_AHEAD = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

// The date is always the server's, in São Paulo (PIX-10); en-CA writes YYYY-MM-DD.
const SAO_PAULO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type ScheduleRecurrence = { frequency: 'ONCE' } | { frequency: 'MONTHLY'; times: number };

export type PixScheduleStatus = 'ACTIVE' | 'FINISHED' | 'CANCELLED';

export interface PixScheduleState {
  id: string;
  payerAccountId: string;
  /** Kept when scheduled, never looked up again (S1). */
  payee: PixPayee;
  amount: Money;
  description: string | null;
  /** A day of São Paulo, YYYY-MM-DD. */
  firstDate: string;
  recurrence: ScheduleRecurrence;
  status: PixScheduleStatus;
  /** The occurrence to pay next, from 1; null once the schedule is not active. */
  nextSequence: number | null;
  nextOccurrenceDate: string | null;
  version: number;
  createdAt: Date;
  cancelledAt: Date | null;
  updatedAt: Date;
}

export interface CreatePixScheduleInput {
  id: string;
  payerAccountId: string;
  payee: PixPayee;
  amount: Money;
  description: string | null;
  firstDate: string;
  recurrence: ScheduleRecurrence;
  now: Date;
}

/**
 * A scheduled or recurring Pix (v1.2.0 plan, task 7; D9, D10): authorized with
 * the PIN once, when scheduled, then paid by the worker on each date. Each
 * occurrence moves it on once, paid or failed (S5), so none is paid twice
 * (EXT-05).
 */
export class PixSchedule {
  #state: PixScheduleState;

  private constructor(state: PixScheduleState) {
    this.#state = { ...state, payee: { ...state.payee }, recurrence: { ...state.recurrence } };
  }

  static create(input: CreatePixScheduleInput): PixSchedule {
    if ((input.payee.accountId === null) === (input.payee.bank === undefined)) {
      throw new Error('A Pix goes to a next bank account or to another bank, never both');
    }
    if (!input.amount.isPositive()) throw new InvalidAmount();
    if (input.payee.accountId === input.payerAccountId) throw new SamePayerAndPayee();
    if (input.description !== null && input.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`A Pix description has at most ${String(MAX_DESCRIPTION_LENGTH)} characters`);
    }
    // It always runs in the daytime (S3), whatever the hour it is scheduled at.
    if (DAYTIME_LIMIT.isLessThan(input.amount)) throw new LimitExceeded(DAYTIME_LIMIT);
    const today = saoPauloDate(input.now);
    if (input.firstDate <= today) throw new ScheduleInPast();
    if (input.firstDate > addDays(today, MAX_DAYS_AHEAD)) throw new InvalidRecurrence();
    if (input.recurrence.frequency === 'MONTHLY') {
      const { times } = input.recurrence;
      if (!Number.isInteger(times) || times < MIN_MONTHLY_TIMES || times > MAX_MONTHLY_TIMES) {
        throw new InvalidRecurrence();
      }
    }

    return new PixSchedule({
      id: input.id,
      payerAccountId: input.payerAccountId,
      payee: input.payee,
      amount: input.amount,
      description: input.description === '' ? null : input.description,
      firstDate: input.firstDate,
      recurrence: input.recurrence,
      status: 'ACTIVE',
      nextSequence: 1,
      nextOccurrenceDate: input.firstDate,
      version: 0,
      createdAt: input.now,
      cancelledAt: null,
      updatedAt: input.now,
    });
  }

  static restore(state: PixScheduleState): PixSchedule {
    return new PixSchedule(state);
  }

  get state(): Readonly<PixScheduleState> {
    return {
      ...this.#state,
      payee: { ...this.#state.payee },
      recurrence: { ...this.#state.recurrence },
    };
  }

  get times(): number {
    const { recurrence } = this.#state;
    return recurrence.frequency === 'ONCE' ? 1 : recurrence.times;
  }

  /**
   * The date of occurrence [sequence]: the first date's day each month,
   * counted from the first date, or the last day of a shorter month (S2).
   */
  occurrenceDate(sequence: number): string {
    const [year, month, day] = this.#state.firstDate.split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const target = new Date(Date.UTC(year, month - 1 + sequence - 1, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }

  /**
   * The occurrence to pay now, if any: on its date or after, when it did not
   * run on the day (S4), and only from 06:00 to 20:00 in São Paulo (S3).
   */
  dueSequence(now: Date): number | null {
    const { status, nextSequence, nextOccurrenceDate } = this.#state;
    if (status !== 'ACTIVE' || nextSequence === null || nextOccurrenceDate === null) return null;
    if (nextOccurrenceDate > saoPauloDate(now) || !isDaytime(now)) return null;
    return nextSequence;
  }

  /** Occurrence [sequence] ran, paid or failed (S5): on to the next, or finished. */
  advance(sequence: number, now: Date): void {
    this.#requireActive();
    if (sequence !== this.#state.nextSequence) {
      throw new Error(`Occurrence ${String(sequence)} is not the next one`);
    }
    if (sequence === this.times) {
      this.#end('FINISHED', now);
    } else {
      this.#state.nextSequence = sequence + 1;
      this.#state.nextOccurrenceDate = this.occurrenceDate(sequence + 1);
      this.#touch(now);
    }
  }

  /**
   * By its owner (S6). True when it changed; a cancelled schedule stays as it
   * was, so a repeated request is no error.
   */
  cancel(now: Date): boolean {
    if (this.#state.status === 'CANCELLED') return false;
    this.#requireActive();
    this.#end('CANCELLED', now);
    this.#state.cancelledAt = now;
    return true;
  }

  #requireActive(): void {
    if (this.#state.status !== 'ACTIVE') throw new ScheduleNotActive();
  }

  #end(status: 'FINISHED' | 'CANCELLED', now: Date): void {
    this.#state.status = status;
    this.#state.nextSequence = null;
    this.#state.nextOccurrenceDate = null;
    this.#touch(now);
  }

  #touch(now: Date): void {
    this.#state.updatedAt = now;
    this.#state.version += 1;
  }
}

/** The day of São Paulo at [now], YYYY-MM-DD. */
export function saoPauloDate(now: Date): string {
  return SAO_PAULO_DATE.format(now);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
