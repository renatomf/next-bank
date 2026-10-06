import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { healthRoutes } from './shared/http/health.ts';
import { registerProblemHandlers } from './shared/http/problem.ts';
import { REDACT_PATHS } from './shared/logging.ts';

/** JSON log destination, one line per event. */
export interface LogDestination {
  write(line: string): void;
}

export interface AppDependencies {
  pool: pg.Pool;
  /** Log destination; defaults to stdout. */
  logStream?: LogDestination;
}

// Accept only short ids without control characters (API-10).
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
    app.log.error({ err }, 'idle database connection error');
  });
  app.addHook('onClose', async () => {
    await pool.end();
  });

  void app.register(helmet);
  // Collects the route schemas into the OpenAPI contract (ADR 0008). Not served over HTTP.
  void app.register(swagger, {
    openapi: { openapi: '3.1.0', info: { title: 'next bank API', version: '0.1.0' } },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  void app.register(healthRoutes, { pool });

  return app;
}
