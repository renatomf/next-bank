import type pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { createPool, guardConnections } from '../../../src/shared/db.ts';
import { withTransaction } from '../../../src/shared/infrastructure/pg-transaction.ts';
import { testDatabaseUrl } from '../../helpers.ts';

// F-54: the database cut the API's connections (the demo reset recreates
// its branch) and the process died with status 1. A client in use emits
// 'error' with no listener, since pg-pool listens only while it is idle,
// and Node ends the process on an unheard 'error'. A guarded pool hears
// every connection, idle or in use, and logs only what the error says.
const pools: pg.Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.end().catch(() => undefined)));
});

function guardedPool() {
  const logged: unknown[] = [];
  const pool = createPool(testDatabaseUrl());
  guardConnections(pool, (error) => logged.push(error));
  pools.push(pool);
  return { pool, logged };
}

/** Cuts the client's link to the database, as a reset or a network fault does. */
function cut(client: pg.PoolClient): void {
  // The socket is pg's own: no public API ends a connection from the far side.
  const connection = Reflect.get(client, 'connection') as { stream: { destroy(): void } };
  connection.stream.destroy();
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('connections the database cuts', () => {
  it('fail the transaction in use and leave the process running', async () => {
    const { pool, logged } = guardedPool();

    const transaction = withTransaction(pool, async (client) => {
      cut(client);
      await settled();
      return client.query('SELECT 1');
    });

    await expect(transaction).rejects.toThrow();
    await settled();
    expect(logged).toEqual([expect.objectContaining({ message: expect.any(String) })]);
    // The pool still serves: the cut connection was discarded, not reused.
    await expect(pool.query('SELECT 1 AS one')).resolves.toMatchObject({ rows: [{ one: 1 }] });
  });

  it('cut while idle, are logged and replaced', async () => {
    const { pool, logged } = guardedPool();
    const client = await pool.connect();
    client.release();

    cut(client);
    await settled();

    expect(logged).toHaveLength(1);
    await expect(pool.query('SELECT 1 AS one')).resolves.toMatchObject({ rows: [{ one: 1 }] });
  });

  it('log what the error says, never the connection it came from', async () => {
    const { pool, logged } = guardedPool();
    const client = await pool.connect();

    cut(client);
    await settled();
    client.release(true);

    expect(logged).toHaveLength(1);
    expect(Object.keys(logged[0] as object).sort()).toEqual(['code', 'message']);
    expect(JSON.stringify(logged)).not.toMatch(/secretKey|nextbank_app|host/);
  });
});
