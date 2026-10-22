import { randomInt } from 'node:crypto';
import { Faults, parseFaultProfile, seededRandom, simulatorPlugin } from '@nextbank/simulator';
import type { FastifyInstance } from 'fastify';
import { createPool } from './shared/db.ts';

export interface MountedSimulatorOptions {
  /** The simulator's own role (S1): it never shares the API's. */
  databaseUrl: string;
  participantKey: string;
  /** SIMULATOR_FAULTS, a JSON fault profile (D5, P4); none when unset. */
  faults?: string;
}

/**
 * Mounts the simulator in the API's service under /simulator (v1.2.0 plan,
 * D2, P2), the one place besides server.ts that imports it. Its routes are
 * public to the API's bearer check because the simulator asks its own key on
 * each of them (EXT-09); the API calls them over HTTP, like any partner.
 */
export async function mountSimulator(
  app: FastifyInstance,
  options: MountedSimulatorOptions,
): Promise<void> {
  const pool = createPool(options.databaseUrl);
  app.addHook('onClose', async () => {
    await pool.end();
  });
  // A fresh seed each boot: the faults of a run are not meant to repeat here.
  const faults = new Faults(parseFaultProfile(options.faults), seededRandom(randomInt(2 ** 32)));
  await app.register(
    async (scope) => {
      scope.addHook('onRoute', (route) => {
        route.config = { ...route.config, public: true };
      });
      await scope.register(simulatorPlugin, {
        pool,
        participantKey: options.participantKey,
        faults,
      });
    },
    { prefix: '/simulator' },
  );
}
