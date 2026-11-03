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
    // Integration tests run against Postgres on a machine that may be busy: 5 s
    // failed sound tests under load (F-49). A test needing more than this is a bug.
    testTimeout: 15_000,
    // Coverage gate (CLAUDE.md, section 5): business rules only. Everything else is
    // judged by testing behavior, not by a number.
    coverage: {
      provider: 'v8',
      // Summary in the terminal only: no report files to ignore or commit.
      reporter: ['text-summary'],
      include: [
        'src/shared/domain/**',
        'src/modules/*/domain/**',
        'src/modules/*/application/**',
        'src/application/**',
      ],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
