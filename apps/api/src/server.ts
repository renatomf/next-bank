import { buildApp } from './app.ts';
import { loadConfig } from './shared/config.ts';
import { createPool } from './shared/db.ts';
import { SentryErrorReporter } from './shared/infrastructure/sentry-error-reporter.ts';

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
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
