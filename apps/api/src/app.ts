import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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
import { onboardingRoutes } from './application/onboarding/http.ts';
import { RegisterCustomer } from './application/onboarding/register-customer.ts';
import {
  type AccessTokenKeys,
  type CpfKeys,
  createIdentityModule,
} from './modules/identity/index.ts';
import { healthRoutes } from './shared/http/health.ts';
import { registerProblemHandlers } from './shared/http/problem.ts';
import { PgUnitOfWork } from './shared/infrastructure/pg-unit-of-work.ts';
import { SystemClock, UuidV7Generator } from './shared/infrastructure/system-ports.ts';
import { REDACT_PATHS } from './shared/logging.ts';

/** JSON log destination, one line per event. */
export interface LogDestination {
  write(line: string): void;
}

export interface AppDependencies {
  pool: pg.Pool;
  /** Log destination; defaults to stdout. */
  logStream?: LogDestination;
  /** Signing and CPF keys: required, there is no insecure default. */
  security: { accessTokenKeys: AccessTokenKeys; cpfKeys: CpfKeys };
}

// Per client IP (API-02). In memory: one instance in V1 (plan D3). Behind the
// deploy proxy, trustProxy must be set or every client shares one counter.
const GLOBAL_RATE_LIMIT = { max: 100, timeWindow: '1 minute' };

// Accept only short ids without control characters (API-10).
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

function requestId(request: IncomingMessage): string {
  const received = request.headers['x-request-id'];
  return typeof received === 'string' && REQUEST_ID.test(received) ? received : randomUUID();
}

/** Composition root: the only place that connects ports to their implementations. */
export function buildApp({ pool, logStream, security }: AppDependencies) {
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
  // Responses carry personal and financial data: no browser, proxy or CDN may keep them (F-06).
  app.addHook('onSend', (_request, reply, payload, done) => {
    void reply.header('cache-control', 'no-store');
    done(null, payload);
  });
  pool.on('error', (err) => {
    app.log.error({ err }, 'idle database connection error');
  });
  app.addHook('onClose', async () => {
    await pool.end();
  });

  void app.register(helmet);
  void app.register(rateLimit, {
    ...GLOBAL_RATE_LIMIT,
    // Thrown, so the error handler answers in the RFC 9457 format.
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error('rate limit exceeded'), { statusCode: context.statusCode }),
  });
  // Collects the route schemas into the OpenAPI contract (ADR 0008). Not served over HTTP.
  void app.register(swagger, {
    openapi: { openapi: '3.1.0', info: { title: 'next bank API', version: '0.1.0' } },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  void app.register(healthRoutes, { pool });

  const identity = createIdentityModule({
    clock: new SystemClock(),
    ids: new UuidV7Generator(),
    accessTokenKeys: security.accessTokenKeys,
    cpfKeys: security.cpfKeys,
  });
  const registerCustomer = new RegisterCustomer({
    unitOfWork: new PgUnitOfWork(pool),
    identity: identity.registration,
  });
  void app.register(onboardingRoutes, { registerCustomer });

  return app;
}
