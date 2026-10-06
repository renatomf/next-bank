import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Locally the URLs come from .env; in CI, from environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Resets the test database and applies all migrations before the run.
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share the same database.
    fileParallelism: false,
  },
});
