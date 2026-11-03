import type { Transaction } from '../../../shared/application/ports.ts';
import { Money } from '../../../shared/domain/money.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type { DivergenceKind } from '../domain/reconciliation.ts';

/** How the staff resolved an exception (v1.3.0, task 6). */
export interface ExceptionResolution {
  exceptionId: string;
  outcome: 'SETTLED' | 'REFUNDED' | 'EXPLAINED';
  approvalRequestId: string | null;
  explanation: string | null;
  resolvedBy: string;
  resolvedAt: Date;
}

/** An exception as the staff reads it, with its resolution once it has one. */
export interface QueuedException {
  id: string;
  runDate: string;
  kind: DivergenceKind;
  endToEndId: string | null;
  expected: Money | null;
  actual: Money | null;
  detectedAt: Date;
  resolution: ExceptionResolution | null;
}

interface ExceptionRow {
  id: string;
  run_date: string;
  kind: DivergenceKind;
  end_to_end_id: string | null;
  expected_cents: string | null;
  actual_cents: string | null;
  detected_at: Date;
  outcome: ExceptionResolution['outcome'] | null;
  approval_request_id: string | null;
  explanation: string | null;
  resolved_by: string | null;
  resolved_at: Date | null;
}

const EXCEPTION_WITH_RESOLUTION = `SELECT e.id, e.run_date::text AS run_date, e.kind,
    e.end_to_end_id, e.expected_cents, e.actual_cents, e.detected_at,
    r.outcome, r.approval_request_id, r.explanation, r.resolved_by, r.resolved_at
  FROM reconciliation.exceptions e
  LEFT JOIN reconciliation.resolutions r ON r.exception_id = e.id`;

/**
 * The exceptions queue of the staff (v1.3.0 plan, task 6), in the caller's
 * transaction: the reconciliation's answer to the port Operations defines.
 * An exception is only read and locked, never written (R5); its resolution
 * is a row of its own, one per exception.
 */
export class PgExceptionQueue {
  /** Newest first, from a position, open only or all; served by exceptions_queue_idx. */
  static readonly PAGE_SQL = `${EXCEPTION_WITH_RESOLUTION}
    WHERE ($1 = 'ALL' OR r.exception_id IS NULL)
      AND ($2::timestamptz IS NULL OR (e.detected_at, e.id) < ($2, $3::uuid))
    ORDER BY e.detected_at DESC, e.id DESC
    LIMIT $4`;

  async exceptionsPage(
    tx: Transaction,
    filter: {
      status: 'OPEN' | 'ALL';
      after: { detectedAt: Date; id: string } | null;
      limit: number;
    },
  ): Promise<QueuedException[]> {
    const { rows } = await pgClientOf(tx).query<ExceptionRow>(PgExceptionQueue.PAGE_SQL, [
      filter.status,
      filter.after?.detectedAt ?? null,
      filter.after?.id ?? null,
      filter.limit,
    ]);
    return rows.map(exceptionOf);
  }

  /** Served by the primary keys. */
  async exceptionById(tx: Transaction, id: string): Promise<QueuedException | null> {
    const { rows } = await pgClientOf(tx).query<ExceptionRow>(
      `${EXCEPTION_WITH_RESOLUTION} WHERE e.id = $1`,
      [id],
    );
    return rows[0] ? exceptionOf(rows[0]) : null;
  }

  /**
   * Locked first and read again after: a lock that waited for another
   * resolution re-reads only the locked row, so a resolution joined in the
   * same statement would still look missing.
   */
  async lockException(tx: Transaction, id: string): Promise<QueuedException | null> {
    const { rowCount } = await pgClientOf(tx).query(
      'SELECT id FROM reconciliation.exceptions WHERE id = $1 FOR UPDATE',
      [id],
    );
    return rowCount === 0 ? null : this.exceptionById(tx, id);
  }

  async recordResolution(tx: Transaction, resolution: ExceptionResolution): Promise<void> {
    await pgClientOf(tx).query(
      `INSERT INTO reconciliation.resolutions
         (exception_id, outcome, approval_request_id, explanation, resolved_by, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        resolution.exceptionId,
        resolution.outcome,
        resolution.approvalRequestId,
        resolution.explanation,
        resolution.resolvedBy,
        resolution.resolvedAt,
      ],
    );
  }
}

function exceptionOf(row: ExceptionRow): QueuedException {
  const cents = (value: string | null) => (value === null ? null : Money.of(BigInt(value)));
  return {
    id: row.id,
    runDate: row.run_date,
    kind: row.kind,
    endToEndId: row.end_to_end_id,
    expected: cents(row.expected_cents),
    actual: cents(row.actual_cents),
    detectedAt: row.detected_at,
    resolution:
      row.outcome && row.resolved_by && row.resolved_at
        ? {
            exceptionId: row.id,
            outcome: row.outcome,
            approvalRequestId: row.approval_request_id,
            explanation: row.explanation,
            resolvedBy: row.resolved_by,
            resolvedAt: row.resolved_at,
          }
        : null,
  };
}
