import type { Outbox, OutboxMessage } from '../application/outbox.ts';
import type { IdGenerator, Transaction } from '../application/ports.ts';
import { pgClientOf } from './pg-unit-of-work.ts';

/**
 * The outbox in Postgres (ADR 0016): the message goes on the connection of
 * the command's transaction. Only the types that have a handler are taken,
 * so a typo never leaves a message no worker will ever deliver. A message is
 * available from the application's clock, the one the worker reads, never
 * the database's: the two may differ.
 */
export class PgOutbox implements Outbox {
  readonly #ids: IdGenerator;
  readonly #clock: () => Date;
  readonly #types: ReadonlySet<string>;

  constructor(deps: { ids: IdGenerator; clock: () => Date; types: ReadonlySet<string> }) {
    this.#ids = deps.ids;
    this.#clock = deps.clock;
    this.#types = deps.types;
  }

  async enqueue(tx: Transaction, message: OutboxMessage): Promise<void> {
    if (!this.#types.has(message.type)) {
      throw new Error(`unknown outbox message type: ${message.type}`);
    }
    await pgClientOf(tx).query(
      `INSERT INTO platform.outbox_messages (id, type, payload, request_id, status, available_at)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)`,
      [this.#ids.next(), message.type, message.payload, message.requestId, this.#clock()],
    );
  }
}
