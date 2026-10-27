import type { Transaction } from '../../../shared/application/ports.ts';
import type { Money } from '../../../shared/domain/money.ts';
import type {
  Divergence,
  DivergenceKind,
  PixHere,
  SettledAtSpi,
} from '../domain/reconciliation.ts';

/** The SPI's settlement files, a partner outside next bank: reading one may fail. */
export interface SettlementFiles {
  /** The payments the SPI settled on a day of São Paulo (`YYYY-MM-DD`). */
  fileOf(date: string): Promise<SettledAtSpi[]>;
}

/**
 * What the reconciliation reads of the Pix to other banks (context map,
 * domain-model.md section 2). Defined here, by the caller; Payments
 * implements it. Read only.
 */
export interface ExternalPixReader {
  /** The Pix with these end-to-end ids; those next bank does not have are left out. */
  byEndToEndIds(tx: Transaction, endToEndIds: string[]): Promise<ReadonlyMap<string, PixHere>>;
  /** The end-to-end ids of the Pix completed in [from, to). */
  completedBetween(tx: Transaction, from: Date, to: Date): Promise<string[]>;
  /** The end-to-end ids of the Pix still waiting for the SPI, authorized before then. */
  waitingSince(tx: Transaction, authorizedBefore: Date): Promise<string[]>;
  /** The sum of every Pix still waiting for the SPI. */
  waitingSum(tx: Transaction): Promise<Money>;
}

/** system:pix_clearing's balance, by the sum of its postings (Ledger). */
export interface ClearingBalance {
  of(tx: Transaction): Promise<Money>;
}

/** The runs and the exceptions, on the caller's transaction. */
export interface ReconciliationRepository {
  /**
   * Reserves the day: true for a day no run has, or one a run left
   * RUNNING before [takeOverBefore]; false for a day done or being done.
   */
  reserve(runDate: string, now: Date, takeOverBefore: Date): Promise<boolean>;
  /** Makes the rest of the transaction read one snapshot; called first. */
  readOneSnapshot(): Promise<void>;
  /** Records the divergences as exceptions, each once per day, kind and Pix. */
  record(runDate: string, divergences: Divergence[], now: Date): Promise<void>;
  finish(
    runDate: string,
    now: Date,
    paymentsChecked: number,
    exceptionsFound: number,
  ): Promise<void>;
}

export interface ReconciliationRepositoryFactory {
  for(tx: Transaction): ReconciliationRepository;
}

/** Tells a person a day had divergences: the date and the counts, never a Pix (R4). */
export interface DivergenceAlarm {
  raise(runDate: string, counts: Partial<Record<DivergenceKind, number>>): void;
}
