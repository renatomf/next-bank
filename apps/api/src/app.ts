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
  createAccountsModule,
  myAccountRoutes,
  statementRoutes,
} from './modules/accounts/index.ts';
import {
  type AccessTokenKeys,
  createIdentityModule,
  loginRoutes,
  mePasswordRoutes,
  meRoutes,
  meSessionsRoutes,
  registerAuthentication,
  pinRoutes,
  sessionRoutes,
} from './modules/identity/index.ts';
import { createLedgerModule } from './modules/ledger/index.ts';
import {
  createPaymentsModule,
  createPaymentsOutboxHandlers,
  HttpSpiClient,
  keyLookupRoutes,
  receivingKeyRoutes,
  spiWebhookRoutes,
  transferRoutes,
} from './modules/payments/index.ts';
import { createTopUpsModule, topUpRoutes } from './modules/top-ups/index.ts';
import { healthRoutes } from './shared/http/health.ts';
import { registerProblemHandlers } from './shared/http/problem.ts';
import type { PiiKeys } from './shared/infrastructure/aes-gcm-pii-protector.ts';
import { createOutbox } from './shared/infrastructure/outbox-factory.ts';
import type { OutboxWorker } from './shared/infrastructure/outbox-worker.ts';
import { PgUnitOfWork } from './shared/infrastructure/pg-unit-of-work.ts';
import type { ErrorReporter } from './shared/application/ports.ts';
import { NoopErrorReporter } from './shared/infrastructure/sentry-error-reporter.ts';
import { SystemClock, UuidV7Generator } from './shared/infrastructure/system-ports.ts';
import { REDACT_PATHS, requestForLog } from './shared/logging.ts';

declare module 'fastify' {
  interface FastifyInstance {
    /** Delivers the outbox; the server runs it in a loop (v1.2.0 plan, D3), tests by hand. */
    outboxWorker: OutboxWorker;
    /** One round of the SPI status check (v1.2.0 plan, task 4); null while it is off. */
    spiStatusCheck: (() => Promise<number>) | null;
  }
}

/** JSON log destination, one line per event. */
export interface LogDestination {
  write(line: string): void;
}

export interface AppDependencies {
  pool: pg.Pool;
  /** Log destination; defaults to stdout. */
  logStream?: LogDestination;
  /** Signing and CPF keys: required, there is no insecure default. */
  security: {
    accessTokenKeys: AccessTokenKeys;
    piiKeys: PiiKeys;
    pinPepper: Uint8Array;
    /** The top-up number's own key (TOP-01, decision R6). */
    topUpPhoneKey: Uint8Array;
  };
  /** Proxies in front of the API (config TRUST_PROXY); none by default. */
  trustProxy?: number;
  /** The commit running, shown by the health check. */
  release?: string;
  /** Where unexpected errors go; nowhere but the logs by default. */
  errorReporter?: ErrorReporter;
  /** The Pix to other banks: off unless given (v1.2.0 plan, P1). */
  externalPix?: { simulatorUrl: string; participantKey: string; webhookSecret: Uint8Array };
}

/** A partner that does not answer in this long is a failure, retried by the caller. */
const SPI_TIMEOUT_MS = 2_000;

// Per client IP (API-02). In memory: one instance in V1 (plan D3). Behind the
// deploy proxy, trustProxy (config TRUST_PROXY) keeps one counter per client.
const GLOBAL_RATE_LIMIT = { max: 100, timeWindow: '1 minute' };

// Accept only short ids without control characters (API-10).
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

function requestId(request: IncomingMessage): string {
  const received = request.headers['x-request-id'];
  return typeof received === 'string' && REQUEST_ID.test(received) ? received : randomUUID();
}

/** Composition root: the only place that connects ports to their implementations. */
export function buildApp({
  pool,
  logStream,
  security,
  trustProxy = 0,
  release,
  errorReporter = new NoopErrorReporter(),
  externalPix,
}: AppDependencies) {
  const app = Fastify({
    // The client is the hop before the trusted proxies: hop 0 is the socket peer,
    // so only the first [trustProxy] hops are believed. With none, X-Forwarded-For
    // is ignored and a client cannot pick its own rate-limit counter (API-02).
    trustProxy: (_address: string, hop: number) => hop < trustProxy,
    logger: {
      level: 'info',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      serializers: { req: requestForLog },
      ...(logStream ? { stream: logStream } : {}),
    },
    genReqId: requestId,
    bodyLimit: 16 * 1024,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerProblemHandlers(app, errorReporter);

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
    openapi: {
      openapi: '3.1.0',
      info: { title: 'next bank API', version: '0.1.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  const clock = new SystemClock();
  const ids = new UuidV7Generator();
  const unitOfWork = new PgUnitOfWork(pool);
  const ledger = createLedgerModule({ clock, ids });
  // Accounts reaches the ledger only through the port it defines (D2).
  const accounts = createAccountsModule({
    unitOfWork,
    clock,
    ids,
    ledger: ledger.customerAccounts,
  });
  const identity = createIdentityModule({
    unitOfWork,
    clock,
    ids,
    accessTokenKeys: security.accessTokenKeys,
    piiKeys: security.piiKeys,
    pinPepper: security.pinPepper,
  });
  // Before any route: every route requires a token unless declared public.
  registerAuthentication(app, identity.accessTokenVerifier, identity.activeSessions, clock);

  void app.register(healthRoutes, { pool, ...(release ? { release } : {}) });
  const paymentsIdentity = {
    payeeOf: identity.payees.payeeOf.bind(identity.payees),
    verifyPin: identity.verifyPin.verify.bind(identity.verifyPin),
  };
  const spi = externalPix
    ? new HttpSpiClient({
        baseUrl: externalPix.simulatorUrl,
        participantKey: externalPix.participantKey,
        timeoutMs: SPI_TIMEOUT_MS,
      })
    : null;
  // The outbox takes only the types its worker delivers (ADR 0016).
  const { outbox, worker } = createOutbox({
    pool,
    ids,
    clock: () => clock.now(),
    errorReporter,
    handlers: createPaymentsOutboxHandlers({
      unitOfWork,
      piiKeys: security.piiKeys,
      accounts: accounts.directory,
      identity: paymentsIdentity,
      spi,
    }),
  });
  app.decorate('outboxWorker', worker);
  // Payments reaches Accounts and Identity only through the ports it defines.
  const payments = createPaymentsModule({
    unitOfWork,
    clock,
    ids,
    piiKeys: security.piiKeys,
    accounts: accounts.directory,
    identity: paymentsIdentity,
    ledger: {
      availableBalance: (tx, accountId) => ledger.customerAccounts.availableBalance(tx, accountId),
      postPixTransfer: (tx, posting) => ledger.customerAccounts.transferPix(tx, posting),
      postExternalPix: (tx, posting) => ledger.customerAccounts.sendPixExternal(tx, posting),
      settleExternalPix: (tx, input) => ledger.customerAccounts.settlePixExternal(tx, input),
      refundExternalPix: (tx, posting) => ledger.customerAccounts.refundPixExternal(tx, posting),
    },
    spi,
    outbox,
  });
  const { checkPendingPix } = payments;
  app.decorate('spiStatusCheck', checkPendingPix ? () => checkPendingPix.execute() : null);
  // Top-ups reach Accounts, Identity and the Ledger only through the ports they define.
  const topUps = createTopUpsModule({
    unitOfWork,
    clock,
    ids,
    piiKeys: security.piiKeys,
    phoneKey: security.topUpPhoneKey,
    accounts: {
      findByHolder: (tx, userId) => accounts.directory.findByHolder(tx, userId),
      lockForShare: async (tx, accountId) => {
        const [locked] = await accounts.directory.lockForShare(tx, [accountId]);
        // Found by its holder in the same transaction: it cannot be missing.
        if (!locked) throw new Error('account missing while locking it');
        return locked;
      },
    },
    identity: { verifyPin: (tx, input) => identity.verifyPin.verify(tx, input) },
    ledger: {
      lockCustomerAccount: (tx, accountId) => ledger.customerAccounts.lockCustomer(tx, accountId),
      postTopUp: (tx, posting) => ledger.customerAccounts.topUp(tx, posting),
    },
  });
  const registerCustomer = new RegisterCustomer({
    unitOfWork,
    identity: identity.registerUser,
    accounts: accounts.openAccount,
    ledger: ledger.customerAccounts,
    payments: payments.createCpfKey,
  });
  void app.register(onboardingRoutes, { registerCustomer });
  void app.register(loginRoutes, { login: identity.login });
  void app.register(sessionRoutes, {
    refreshSession: identity.refreshSession,
    logout: identity.logout,
  });
  void app.register(pinRoutes, {
    createPin: identity.createPin,
    verifyPin: identity.verifyPin,
    changePin: identity.changePin,
  });
  void app.register(meRoutes, { getProfile: identity.getProfile });
  void app.register(mePasswordRoutes, { changePassword: identity.changePassword });
  void app.register(meSessionsRoutes, {
    listSessions: identity.listSessions,
    revokeSession: identity.revokeSession,
  });
  void app.register(keyLookupRoutes, { lookupPixKey: payments.lookupPixKey });
  void app.register(receivingKeyRoutes, { getReceivingKey: payments.getReceivingKey });
  // The SPI's answer (v1.2.0 plan, task 4): only where the Pix to other banks is on.
  if (externalPix) {
    void app.register(spiWebhookRoutes, {
      applySpiOutcome: payments.applySpiOutcome,
      webhookSecret: externalPix.webhookSecret,
      clock,
    });
  }
  void app.register(transferRoutes, {
    createPixTransfer: payments.createPixTransfer,
    authorizePixTransfer: payments.authorizePixTransfer,
    getPixTransfer: payments.getPixTransfer,
    cancelPixTransfer: payments.cancelPixTransfer,
  });
  void app.register(topUpRoutes, { createTopUp: topUps.createTopUp, getTopUp: topUps.getTopUp });
  void app.register(myAccountRoutes, { getMyAccount: accounts.getMyAccount });
  void app.register(statementRoutes, { getMyStatement: accounts.getMyStatement });

  return app;
}
