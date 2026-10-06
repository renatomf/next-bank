import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Localmente, as URLs vêm do .env; no CI, de variáveis de ambiente.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Os testes de integração compartilham o mesmo banco.
    fileParallelism: false,
  },
});
