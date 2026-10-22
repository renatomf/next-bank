import { randomBytes } from 'node:crypto';
import { Faults, parseFaultProfile, seededRandom, simulatorPlugin } from '@nextbank/simulator';
import Fastify from 'fastify';
import pg from 'pg';

/** A throwaway participant key, as the API and the simulator share it in production. */
export const participantKey = randomBytes(32).toString('base64');

/** A key of the made-up Banco Aurora, from the simulator's seed. */
export const AURORA_KEY = 'clara.aurora@example.com';

export interface RunningSimulator {
  /** Where the API calls it, as SIMULATOR_URL says in production. */
  url: string;
  /** Its own role on the test database, to see what it recorded. */
  pool: pg.Pool;
  close(): Promise<void>;
}

/**
 * The simulator mounted under /simulator, as in the API's service (v1.2.0
 * plan, D2), listening on 127.0.0.1 with its own role and the given faults.
 */
export async function startSimulator(
  faults: Record<string, number> = {},
): Promise<RunningSimulator> {
  const url = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!url) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  const app = Fastify({ logger: false });
  await app.register(simulatorPlugin, {
    prefix: '/simulator',
    pool,
    participantKey,
    faults: new Faults(parseFaultProfile(JSON.stringify(faults)), seededRandom(1)),
  });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  return {
    url: `${address}/simulator`,
    pool,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}
