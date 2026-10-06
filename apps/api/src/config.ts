import { z } from 'zod';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const schema = z.object({
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    // A API nunca roda com o papel de migração (API-07).
    .refine((url) => URL.parse(url)?.username !== 'nextbank_migrator', {
      message: 'não pode usar o papel nextbank_migrator',
    }),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  // Padrão seguro: só localhost. Em contêiner, o deploy define HOST=0.0.0.0.
  HOST: z.string().min(1).default('127.0.0.1'),
});

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
}

/** Valida o ambiente na inicialização. A mensagem de erro nunca inclui os valores recebidos. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const reason = issue.code === 'custom' ? issue.message : 'ausente ou inválida';
      return `${issue.path.join('.')}: ${reason}`;
    });
    throw new ConfigError(`Configuração inválida:\n${problems.join('\n')}`);
  }
  return {
    databaseUrl: result.data.DATABASE_URL,
    port: result.data.PORT,
    host: result.data.HOST,
  };
}
