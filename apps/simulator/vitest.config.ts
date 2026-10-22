import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Locally the URLs come from .env; in CI, from environment variables.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Resets the simulator's schema and applies its migrations before the run.
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share the same database.
    fileParallelism: false,
    // Coverage gate, as the API's (CLAUDE.md, section 5): the simulator's rules,
    // its base and its modules. The server and the config are judged by their
    // tests, not by a number.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      include: ['src/base/**', 'src/modules/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
