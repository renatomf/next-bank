import { randomInt } from 'node:crypto';
import {
  Faults,
  parseFaultProfile,
  seededRandom,
  simulatorPlugin,
  WebhookDispatcher,
} from '@nextbank/simulator';
import type { FastifyInstance } from 'fastify';
import { createPool, guardConnections } from './shared/db.ts';

export interface MountedSimulatorOptions {
  /** The simulator's own role (S1): it never shares the API's. */
  databaseUrl: string;
  participantKey: string;
  /** What the SPI signs its webhooks with (EXT-01). */
  webhookSecret: Uint8Array;
  /** Where the SPI's webhooks go: the API's own route, on 127.0.0.1. */
  webhookUrl: string;
  /** SIMULATOR_FAULTS, a JSON fault profile (D5, P4); none when unset. */
  faults?: string;
  /** Repeats the faults of a run (v1.2.0 plan, task 9, C3); drawn at each boot by default. */
  faultSeed?: number;
  /** The SPI's time, the system's by default; the chaos test moves it with the API's (C4). */
  clock?: () => Date;
}

/** The mounted simulator's own work, which the server runs in a loop. */
export interface MountedSimulator {
  /** Decides the payments due and sends their webhooks; returns how many it claimed. */
  dispatchDue(): Promise<number>;
}

/** A partner that does not answer in this long gets the webhook again later. */
const WEBHOOK_TIMEOUT_MS = 3_000;

/**
 * Mounts the simulator in the API's service under /simulator (v1.2.0 plan,
 * D2, P2), the one place besides server.ts that imports it. Its routes are
 * public to the API's bearer check because the simulator asks its own key on
 * each of them (EXT-09); the API calls them over HTTP, like any partner, and
 * the SPI answers by posting signed webhooks to the API (task 4).
 */
export async function mountSimulator(
  app: FastifyInstance,
  options: MountedSimulatorOptions,
): Promise<MountedSimulator> {
  const pool = createPool(options.databaseUrl);
  // Its connections are cut with the API's, as on the demo reset (F-54).
  guardConnections(pool, (lost) => {
    app.log.error({ lost }, 'simulator database connection lost');
  });
  app.addHook('onClose', async () => {
    await pool.end();
  });
  // A fresh seed each boot: the faults of a run are not meant to repeat here,
  // unless a test asks to.
  const seed = options.faultSeed ?? randomInt(2 ** 32);
  const faults = new Faults(parseFaultProfile(options.faults), seededRandom(seed));
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
  const dispatcher = new WebhookDispatcher({
    pool,
    faults,
    clock: options.clock ?? (() => new Date()),
    webhook: { url: options.webhookUrl, secret: options.webhookSecret },
    send: async (url, body, headers) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  });
  return { dispatchDue: () => dispatcher.dispatchDue() };
}
