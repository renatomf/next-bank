import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // server-only throws outside the server's build; the tests are the server.
    alias: { 'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)) },
  },
  test: { include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
});
