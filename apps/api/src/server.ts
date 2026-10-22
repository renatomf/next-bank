import { buildApp } from './app.ts';
import { mountSimulator } from './mount-simulator.ts';
import { loadConfig } from './shared/config.ts';
import { createPool } from './shared/db.ts';
import { SentryErrorReporter } from './shared/infrastructure/sentry-error-reporter.ts';

/** How often the worker looks for messages to deliver (ADR 0016). */
const OUTBOX_POLL_MS = 1_000;

const config = loadConfig(process.env);
const app = buildApp({
  pool: createPool(config.databaseUrl),
  trustProxy: config.trustProxy,
  ...(config.release ? { release: config.release } : {}),
  // Errors reach Sentry only where a DSN is set; otherwise they stay in the logs.
  ...(config.sentry
    ? {
        errorReporter: new SentryErrorReporter({
          ...config.sentry,
          ...(config.release ? { release: config.release } : {}),
        }),
      }
    : {}),
  security: {
    accessTokenKeys: config.jwt,
    piiKeys: {
      keyVersion: config.pii.keyVersion,
      encryptionKey: config.pii.encryptionKey,
      hmacKey: config.pii.hmacKey,
    },
    pinPepper: config.pinPepper,
    topUpPhoneKey: config.topUpPhoneKey,
  },
  ...(config.externalPix ? { externalPix: config.externalPix } : {}),
});
// The simulator of the Bacen and the other partners, in this same service (D2).
if (config.simulator) await mountSimulator(app, config.simulator);

// The outbox worker runs in the API's process (D3); one round at a time.
let delivering = false;
const outboxLoop = setInterval(() => {
  if (delivering) return;
  delivering = true;
  app.outboxWorker
    .runOnce()
    .catch((err: unknown) => {
      app.log.error({ err }, 'outbox delivery failed');
    })
    .finally(() => {
      delivering = false;
    });
}, OUTBOX_POLL_MS);
app.addHook('onClose', () => {
  clearInterval(outboxLoop);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
