import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 30_000,
  });
}

/** What a lost connection says, without the connection itself. */
export interface LostConnection {
  message: string;
  code: string | null;
}

/**
 * Hears every connection of [pool] the database cuts, idle or in use (F-54).
 * pg-pool listens to a client only while it is idle; a client in use emits
 * 'error' to no one, and Node ends the process on an unheard 'error'. The
 * query in flight still fails, and the pool discards the broken client. The
 * log gets the message and the code only: pg hangs the client on the error,
 * with its host, user and cancel key.
 */
export function guardConnections(pool: pg.Pool, log: (lost: LostConnection) => void): void {
  const hear = (error: Error) => {
    const code: unknown = Reflect.get(error, 'code');
    log({ message: error.message, code: typeof code === 'string' ? code : null });
  };
  // Idle, the pool hears the client; in use, from checkout to release, this does.
  pool.on('error', hear);
  pool.on('acquire', (client) => {
    client.on('error', hear);
  });
  pool.on('release', (_error, client) => {
    client.removeListener('error', hear);
  });
}
