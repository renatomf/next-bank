import type pg from 'pg';
import type { Outbox, OutboxHandler } from '../application/outbox.ts';
import type { ErrorReporter, IdGenerator } from '../application/ports.ts';
import { OutboxWorker } from './outbox-worker.ts';
import { PgOutbox } from './pg-outbox.ts';

/**
 * The outbox and its worker from one map of handlers (ADR 0016): the types a
 * command may write are exactly the ones a worker delivers, so no message is
 * ever written that would wait forever.
 */
export function createOutbox(deps: {
  pool: pg.Pool;
  ids: IdGenerator;
  clock: () => Date;
  errorReporter: ErrorReporter;
  handlers: ReadonlyMap<string, OutboxHandler>;
}): { outbox: Outbox; worker: OutboxWorker } {
  return {
    outbox: new PgOutbox({
      ids: deps.ids,
      clock: deps.clock,
      types: new Set(deps.handlers.keys()),
    }),
    worker: new OutboxWorker({
      pool: deps.pool,
      clock: deps.clock,
      handlers: deps.handlers,
      errorReporter: deps.errorReporter,
    }),
  };
}
