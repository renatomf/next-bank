import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Locally the URLs come from .env; in CI, from environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Integration tests share the same database.
    fileParallelism: false,
  },
});
