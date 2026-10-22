import type pg from 'pg';
import {
  type DeliveredMessage,
  nextDelivery,
  type OutboxHandler,
  type OutboxPayload,
} from '../application/outbox.ts';
import type { ErrorReporter } from '../application/ports.ts';
import { withTransaction } from './pg-transaction.ts';

interface ClaimedRow {
  id: string;
  type: string;
  payload: OutboxPayload;
  attempts: number;
  request_id: string | null;
}

/** How long a claim holds a message while its handler runs; longer than any handler. */
const CLAIM_MS = 30_000;

/**
 * Delivers the outbox (v1.2.0 plan, task 2; ADR 0016), at least once. No
 * lock is held while a handler runs (F-40): the available messages of the
 * known types are claimed in one short transaction (SKIP LOCKED, so two
 * workers never claim the same one), handled with no transaction open, and
 * their outcome recorded in another. A claim left by a worker that died runs
 * out after [CLAIM_MS]. A message that keeps failing is given up after the
 * last attempt and reported, without its payload, for a person to decide
 * (EXT-08).
 */
export class OutboxWorker {
  readonly #pool: pg.Pool;
  readonly #clock: () => Date;
  readonly #handlers: ReadonlyMap<string, OutboxHandler>;
  readonly #errorReporter: ErrorReporter;

  constructor(deps: {
    pool: pg.Pool;
    clock: () => Date;
    handlers: ReadonlyMap<string, OutboxHandler>;
    errorReporter: ErrorReporter;
  }) {
    this.#pool = deps.pool;
    this.#clock = deps.clock;
    this.#handlers = deps.handlers;
    this.#errorReporter = deps.errorReporter;
  }

  /** Delivers the messages available now, at most [limit]; returns how many it claimed. */
  async runOnce(limit = 10): Promise<number> {
    const now = this.#clock();
    const claimed = await this.#claim(now, limit);
    for (const row of claimed) await this.#deliver(row, now);
    return claimed.length;
  }

  async #claim(now: Date, limit: number): Promise<ClaimedRow[]> {
    return withTransaction(this.#pool, async (client) => {
      // Served by outbox_messages_available_idx.
      const { rows } = await client.query<ClaimedRow>(
        `SELECT id, type, payload, attempts, request_id
         FROM platform.outbox_messages
         WHERE status = 'PENDING' AND available_at <= $1
           AND (locked_until IS NULL OR locked_until <= $1)
           AND type = ANY($2)
         ORDER BY available_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED`,
        [now, [...this.#handlers.keys()], limit],
      );
      if (rows.length > 0) {
        await client.query(
          'UPDATE platform.outbox_messages SET locked_until = $2 WHERE id = ANY($1)',
          [rows.map((row) => row.id), new Date(now.getTime() + CLAIM_MS)],
        );
      }
      return rows;
    });
  }

  async #deliver(row: ClaimedRow, now: Date): Promise<void> {
    const handler = this.#handlers.get(row.type);
    const message: DeliveredMessage = {
      id: row.id,
      type: row.type,
      payload: row.payload,
      attempts: row.attempts,
    };
    try {
      if (!handler) throw new Error(`no handler for ${row.type}`);
      await handler(message);
    } catch (error) {
      await this.#failed(row, error, now);
      return;
    }
    await this.#pool.query(
      `UPDATE platform.outbox_messages
       SET status = 'DONE', attempts = $2, processed_at = $3, locked_until = NULL
       WHERE id = $1`,
      [row.id, row.attempts + 1, now],
    );
  }

  async #failed(row: ClaimedRow, error: unknown, now: Date): Promise<void> {
    const attempts = row.attempts + 1;
    const next = nextDelivery(attempts, now);
    // Only the error's name: its message may carry anything (API-04).
    const lastError = (error instanceof Error ? error.name : 'Error').slice(0, 80);
    await this.#pool.query(
      `UPDATE platform.outbox_messages
       SET status = $2, attempts = $3, available_at = $4, last_error = $5, locked_until = NULL
       WHERE id = $1`,
      [
        row.id,
        next.status,
        attempts,
        next.status === 'PENDING' ? next.availableAt : now,
        lastError,
      ],
    );
    if (next.status === 'DEAD') {
      this.#errorReporter.report(error, {
        requestId: row.request_id ?? row.id,
        method: 'OUTBOX',
        route: row.type,
      });
    }
  }
}
