import { buildApp } from './app.ts';
import { mountSimulator } from './mount-simulator.ts';
import { loadConfig } from './shared/config.ts';
import { createPool } from './shared/db.ts';
import { SentryErrorReporter } from './shared/infrastructure/sentry-error-reporter.ts';

/** How often the worker looks for messages to deliver (ADR 0016). */
const OUTBOX_POLL_MS = 1_000;
/** How often the mounted SPI sends the webhooks it owes. */
const WEBHOOK_DISPATCH_MS = 1_000;
/** How often the Pix left without the SPI's answer are checked (v1.2.0 plan, W2). */
const STATUS_CHECK_MS = 60_000;
/** How often the day due is reconciled, if not yet: a missed run is made up (R3). */
const RECONCILIATION_CHECK_MS = 60 * 60_000;

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

/**
 * Runs [round] every [ms] in the API's process (D3), one round at a time: a
 * slow round is never overlapped by the next. A failed round is logged and
 * the next one tries again.
 */
function everyRound(name: string, ms: number, round: () => Promise<unknown>): void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    round()
      .catch((err: unknown) => {
        app.log.error({ err }, `${name} failed`);
      })
      .finally(() => {
        running = false;
      });
  }, ms);
  app.addHook('onClose', () => {
    clearInterval(timer);
  });
}

// The simulator of the Bacen and the other partners, in this same service
// (D2); its webhooks come back to this API on 127.0.0.1.
if (config.simulator) {
  const simulator = await mountSimulator(app, {
    ...config.simulator,
    webhookUrl: `http://127.0.0.1:${String(config.port)}/v1/spi/webhooks`,
  });
  everyRound('webhook dispatch', WEBHOOK_DISPATCH_MS, () => simulator.dispatchDue());
}

everyRound('outbox delivery', OUTBOX_POLL_MS, () => app.outboxWorker.runOnce());
const statusCheck = app.spiStatusCheck;
if (statusCheck) everyRound('SPI status check', STATUS_CHECK_MS, statusCheck);
const reconcile = app.reconcileDueDay;
if (reconcile) everyRound('reconciliation', RECONCILIATION_CHECK_MS, reconcile);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
