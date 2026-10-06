import type pg from 'pg';

/**
 * Runs the work on one connection inside BEGIN/COMMIT, rolling back on any
 * error. READ COMMITTED with explicit locks where needed (database.md, section 7).
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    client.release();
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackError) {
      // A connection that cannot roll back is discarded instead of reused.
      client.release(rollbackError instanceof Error ? rollbackError : true);
    }
    throw error;
  }
}
