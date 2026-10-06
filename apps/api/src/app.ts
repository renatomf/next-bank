import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { healthRoutes } from './http/health.ts';
import { registerProblemHandlers } from './http/problem.ts';
import { REDACT_PATHS } from './logging.ts';

/** Destino dos logs em JSON, uma linha por evento. */
export interface LogDestination {
  write(line: string): void;
}

export interface AppDependencies {
  pool: pg.Pool;
  /** Destino dos logs; padrão: stdout. */
  logStream?: LogDestination;
}

// Só aceita ids curtos e sem caracteres de controle (API-10).
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

function requestId(request: IncomingMessage): string {
  const received = request.headers['x-request-id'];
  return typeof received === 'string' && REQUEST_ID.test(received) ? received : randomUUID();
}

export function buildApp({ pool, logStream }: AppDependencies) {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      ...(logStream ? { stream: logStream } : {}),
    },
    genReqId: requestId,
    bodyLimit: 16 * 1024,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerProblemHandlers(app);

  app.addHook('onRequest', (request, reply, done) => {
    void reply.header('x-request-id', request.id);
    done();
  });
  pool.on('error', (err) => {
    app.log.error({ err }, 'erro em conexão ociosa do banco');
  });
  app.addHook('onClose', async () => {
    await pool.end();
  });

  void app.register(helmet);
  void app.register(healthRoutes, { pool });

  return app;
}
