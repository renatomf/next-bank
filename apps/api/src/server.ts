import { buildApp } from './app.ts';
import { loadConfig } from './shared/config.ts';
import { createPool } from './shared/db.ts';

const config = loadConfig(process.env);
const app = buildApp({ pool: createPool(config.databaseUrl) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.port, host: config.host });
