import type pg from 'pg';
import type { Transaction, UnitOfWork } from '../application/ports.ts';
import { withTransaction } from './pg-transaction.ts';

/** A transaction backed by one Postgres connection. */
export class PgTransaction implements Transaction {
  readonly kind = 'transaction';
  readonly client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.client = client;
  }
}

/** The single point where a module's infrastructure turns a Transaction into a connection. */
export function pgClientOf(tx: Transaction): pg.ClientBase {
  if (!(tx instanceof PgTransaction)) throw new Error('Not a Postgres transaction');
  return tx.client;
}

export class PgUnitOfWork implements UnitOfWork {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return withTransaction(this.#pool, (client) => work(new PgTransaction(client)));
  }
}
