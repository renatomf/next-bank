import pg from 'pg';
import { buildSimulator } from './app.ts';
import { Faults, seededRandom } from './base/faults.ts';
import { type Send, WebhookDispatcher } from './base/webhook-dispatcher.ts';
import { loadConfig } from './config.ts';

// The simulator alone, for local development and CI. In production it is
// mounted in the API's service (v1.2.0 plan, D2), from task 3.
const config = loadConfig(process.env);
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
const faults = new Faults(config.faults, seededRandom(config.seed));
const app = buildSimulator({ pool, participantKey: config.participantKey, faults, logger: true });

// Well under the role's idle-in-transaction timeout (10 s): the dispatcher
// keeps its transaction open while it sends.
const send: Send = async (url, body, headers) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const dispatcher = new WebhookDispatcher({
  pool,
  faults,
  clock: () => new Date(),
  webhook: config.webhook,
  send,
});
const timer = setInterval(() => {
  dispatcher.dispatchDue().catch((error: unknown) => {
    app.log.error({ err: error }, 'webhook dispatch failed');
  });
}, 1_000);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(timer);
    void app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
