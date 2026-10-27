import type { Transaction } from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';

/** What the reconciliation reads of a Pix to another bank: never who it went to. */
export interface ExternalPixReading {
  amount: Money;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

/**
 * The Pix to other banks as the daily reconciliation reads them (v1.2.0
 * plan, task 6), on the caller's transaction: only end-to-end ids, amounts
 * and states, never the payee. Read only.
 */
export class PgExternalPixReader {
  /** Served by the pix_transfers_end_to_end_id_key unique index. */
  async byEndToEndIds(
    tx: Transaction,
    endToEndIds: string[],
  ): Promise<ReadonlyMap<string, ExternalPixReading>> {
    const { rows } = await pgClientOf(tx).query<{
      end_to_end_id: string;
      amount: string;
      status: ExternalPixReading['status'];
    }>(
      `SELECT end_to_end_id, amount::text AS amount, status FROM payments.pix_transfers
       WHERE end_to_end_id = ANY($1) AND payee_ispb IS NOT NULL`,
      [endToEndIds],
    );
    return new Map(
      rows.map((row) => [
        row.end_to_end_id,
        { amount: Money.of(BigInt(row.amount)), status: row.status },
      ]),
    );
  }

  /** Served by the pix_transfers_external_completed_idx partial index. */
  async completedBetween(tx: Transaction, from: Date, to: Date): Promise<string[]> {
    const { rows } = await pgClientOf(tx).query<{ end_to_end_id: string }>(
      `SELECT end_to_end_id FROM payments.pix_transfers
       WHERE status = 'COMPLETED' AND payee_ispb IS NOT NULL
         AND completed_at >= $1 AND completed_at < $2`,
      [from, to],
    );
    return rows.map((row) => row.end_to_end_id);
  }

  /** Served by the pix_transfers_external_processing_idx partial index. */
  async waitingSince(tx: Transaction, authorizedBefore: Date): Promise<string[]> {
    const { rows } = await pgClientOf(tx).query<{ end_to_end_id: string }>(
      `SELECT end_to_end_id FROM payments.pix_transfers
       WHERE status = 'PROCESSING' AND payee_ispb IS NOT NULL AND authorized_at < $1
       ORDER BY authorized_at`,
      [authorizedBefore],
    );
    return rows.map((row) => row.end_to_end_id);
  }

  /** Served by the same partial index: every Pix still waiting for the SPI. */
  async waitingSum(tx: Transaction): Promise<Money> {
    const { rows } = await pgClientOf(tx).query<{ sum: string }>(
      `SELECT coalesce(sum(amount), 0)::text AS sum FROM payments.pix_transfers
       WHERE status = 'PROCESSING' AND payee_ispb IS NOT NULL`,
    );
    return Money.of(BigInt(rows[0]?.sum ?? '0'));
  }
}
