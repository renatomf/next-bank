import type pg from 'pg';
import type { IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import type {
  ReconciliationRepository,
  ReconciliationRepositoryFactory,
} from '../application/ports.ts';
import type { Divergence } from '../domain/reconciliation.ts';

export class PgReconciliationRepository implements ReconciliationRepository {
  readonly #client: pg.ClientBase;
  readonly #ids: IdGenerator;

  constructor(client: pg.ClientBase, ids: IdGenerator) {
    this.#client = client;
    this.#ids = ids;
  }

  /**
   * Inserting the run reserves the day; a run left RUNNING before
   * [takeOverBefore] is taken over. Both by the primary key, so two
   * instances never hold the same day.
   */
  async reserve(runDate: string, now: Date, takeOverBefore: Date): Promise<boolean> {
    const inserted = await this.#client.query(
      `INSERT INTO reconciliation.runs (run_date, status, started_at)
       VALUES ($1, 'RUNNING', $2)
       ON CONFLICT (run_date) DO NOTHING`,
      [runDate, now],
    );
    if (inserted.rowCount === 1) return true;
    const taken = await this.#client.query(
      `UPDATE reconciliation.runs SET started_at = $2
       WHERE run_date = $1 AND status = 'RUNNING' AND started_at < $3`,
      [runDate, now, takeOverBefore],
    );
    return taken.rowCount === 1;
  }

  /** Must be the transaction's first statement: everything after reads one snapshot. */
  async readOneSnapshot(): Promise<void> {
    await this.#client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  }

  /** Once per day, kind and Pix: a day reconciled again adds nothing. */
  async record(runDate: string, divergences: Divergence[], now: Date): Promise<void> {
    for (const divergence of divergences) {
      await this.#client.query(
        `INSERT INTO reconciliation.exceptions
           (id, run_date, kind, end_to_end_id, expected_cents, actual_cents, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ON CONSTRAINT exceptions_run_date_kind_end_to_end_id_key DO NOTHING`,
        [
          this.#ids.next(),
          runDate,
          divergence.kind,
          divergence.endToEndId,
          divergence.expected?.cents.toString() ?? null,
          divergence.actual?.cents.toString() ?? null,
          now,
        ],
      );
    }
  }

  async finish(
    runDate: string,
    now: Date,
    paymentsChecked: number,
    exceptionsFound: number,
  ): Promise<void> {
    await this.#client.query(
      `UPDATE reconciliation.runs
       SET status = 'DONE', finished_at = $2, payments_checked = $3, exceptions_found = $4
       WHERE run_date = $1`,
      [runDate, now, paymentsChecked, exceptionsFound],
    );
  }
}

/** The repository on the connection of the shared transaction (ADR 0010). */
export class PgReconciliationRepositories implements ReconciliationRepositoryFactory {
  readonly #ids: IdGenerator;

  constructor(ids: IdGenerator) {
    this.#ids = ids;
  }

  for(tx: Transaction): ReconciliationRepository {
    return new PgReconciliationRepository(pgClientOf(tx), this.#ids);
  }
}
