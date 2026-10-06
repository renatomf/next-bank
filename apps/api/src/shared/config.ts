import { z } from 'zod';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const schema = z.object({
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    // The API never runs with the migration role (API-07).
    .refine((url) => URL.parse(url)?.username !== 'nextbank_migrator', {
      message: 'must not use the nextbank_migrator role',
    }),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  // Safe default: localhost only. In a container, the deploy sets HOST=0.0.0.0.
  HOST: z.string().min(1).default('127.0.0.1'),
});

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
}

/** Validates the environment at boot. Error messages never include the received values. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const reason = issue.code === 'custom' ? issue.message : 'missing or invalid';
      return `${issue.path.join('.')}: ${reason}`;
    });
    throw new ConfigError(`Invalid configuration:\n${problems.join('\n')}`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    port: result.data.PORT,
    host: result.data.HOST,
  };
}
