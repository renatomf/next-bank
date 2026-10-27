import type { Money } from '../../../shared/domain/money.ts';

// São Paulo is UTC−3, with no daylight saving since 2019, as the SPI's file.
const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The day before is reconciled from this hour in São Paulo (R3). */
const RECONCILE_FROM_HOUR = 3;

/** A day of São Paulo (`YYYY-MM-DD`): when it starts and ends, and the day before. */
export function saoPauloDay(date: string): { start: Date; end: Date; dayBefore: string } {
  const start = new Date(`${date}T00:00:00-03:00`);
  return {
    start,
    end: new Date(start.getTime() + DAY_MS),
    dayBefore: dateOf(new Date(start.getTime() - DAY_MS)),
  };
}

/**
 * The day to reconcile at [now] (R3): yesterday in São Paulo once it is
 * 03:00 there, so the last webhooks and status checks of the day are in;
 * before that, the day before yesterday.
 */
export function dayToReconcile(now: Date): string {
  // The clock moved to São Paulo: its UTC fields read as the local time there.
  const local = now.getTime() - SAO_PAULO_OFFSET_MS;
  const daysBack = new Date(local).getUTCHours() >= RECONCILE_FROM_HOUR ? 1 : 2;
  return new Date(local - daysBack * DAY_MS).toISOString().slice(0, 10);
}

/** The calendar day in São Paulo of an instant. */
function dateOf(instant: Date): string {
  return new Date(instant.getTime() - SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

/** A payment in the SPI's settlement file. */
export interface SettledAtSpi {
  endToEndId: string;
  amount: Money;
}

/** A Pix to another bank as next bank has it, found by its end-to-end id. */
export interface PixHere {
  amount: Money;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export type DivergenceKind =
  | 'MISSING_HERE'
  | 'MISSING_AT_SPI'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'STALE_PROCESSING'
  | 'CLEARING_MISMATCH';

/** What a day's reconciliation found: the SPI's side as expected, next bank's as actual. */
export interface Divergence {
  kind: DivergenceKind;
  /** Null only for the clearing balance, which is no single Pix. */
  endToEndId: string | null;
  expected: Money | null;
  actual: Money | null;
}

/** Everything one day's reconciliation compares (v1.2.0 plan, task 6). */
export interface ReconciliationInput {
  /** The SPI's settlement file of the day. */
  settledOnDay: SettledAtSpi[];
  /** The file of the day before: a Pix completed today may have settled then (R1). */
  settledDayBefore: SettledAtSpi[];
  /** next bank's Pix for each payment of the day's file, by end-to-end id. */
  ours: ReadonlyMap<string, PixHere>;
  /** The end-to-end ids of the Pix to other banks next bank completed on the day. */
  completedOnDay: string[];
  /** The Pix still waiting for the SPI after over a day (R2). */
  stale: string[];
  /** system:pix_clearing's balance and the sum of the Pix waiting (domain-model.md §6). */
  clearing: { balance: Money; processingSum: Money };
}

/**
 * The divergences between the SPI's settlement and next bank's records
 * (EXT-04), matched by end-to-end id rather than by the hour (R1). Pure: it
 * decides nothing about the money; a person resolves each one (D6, D7).
 */
export function findDivergences(input: ReconciliationInput): Divergence[] {
  const divergences: Divergence[] = [];
  const found = (
    kind: DivergenceKind,
    endToEndId: string | null,
    expected: Money | null = null,
    actual: Money | null = null,
  ) => divergences.push({ kind, endToEndId, expected, actual });

  for (const payment of input.settledOnDay) {
    const pix = input.ours.get(payment.endToEndId);
    if (pix === undefined) {
      found('MISSING_HERE', payment.endToEndId, payment.amount);
    } else if (pix.amount.cents !== payment.amount.cents) {
      found('AMOUNT_MISMATCH', payment.endToEndId, payment.amount, pix.amount);
    } else if (pix.status !== 'COMPLETED') {
      found('STATUS_MISMATCH', payment.endToEndId);
    }
  }

  const settled = new Set(
    [...input.settledOnDay, ...input.settledDayBefore].map((payment) => payment.endToEndId),
  );
  for (const endToEndId of input.completedOnDay) {
    if (!settled.has(endToEndId)) found('MISSING_AT_SPI', endToEndId);
  }

  for (const endToEndId of input.stale) found('STALE_PROCESSING', endToEndId);

  const { balance, processingSum } = input.clearing;
  if (balance.cents !== processingSum.cents) {
    found('CLEARING_MISMATCH', null, processingSum, balance);
  }
  return divergences;
}
