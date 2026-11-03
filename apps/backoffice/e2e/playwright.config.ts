import { defineConfig, devices } from '@playwright/test';

// The backoffice end to end (v1.3.0 plan, task 9): the built backoffice
// against the real API and Postgres, on Chromium only (P2). The members sign
// in once, in the setup, and the tests reuse their sessions (P6). No retry: a
// flaky test is a bug (P4); the trace is kept only when a test fails.
const PORT = 3101;

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  // Beside the backoffice, where the CI uploads them when a test fails.
  outputDir: '../test-results',
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: /\.spec\.ts/,
    },
  ],
  // The production build, as published: `pnpm build` comes first. API_URL and
  // BACKOFFICE_API_KEY come from the environment, or from .env.local locally.
  webServer: {
    command: `pnpm exec next start -p ${String(PORT)}`,
    // The backoffice's folder, where the build is; the config lives in e2e/.
    cwd: '..',
    url: `http://localhost:${String(PORT)}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
