import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Locally the URLs come from .env; in CI, from environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

// The chaos test (v1.2.0 plan, task 9) alone: it checks invariants over the
// whole database, so it runs on a database no other test touched, and it
// takes minutes, so the everyday suite stays fast.
export default defineConfig({
  test: {
    include: ['test/chaos/**/*.chaos.ts'],
    // Resets the test database and applies all migrations before the run.
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
});
