import { createPrivateKey, type KeyObject } from 'node:crypto';
import { z } from 'zod';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeBase64(value: string): Buffer | null {
  return BASE64.test(value) ? Buffer.from(value, 'base64') : null;
}

/** Ed25519 private key in PKCS#8 DER, base64 on one line (fits an environment variable). */
function parseEd25519PrivateKey(value: string): KeyObject | null {
  const der = decodeBase64(value);
  if (!der) return null;
  try {
    const key = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    return key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

const key32 = z.string().refine((value) => decodeBase64(value)?.length === 32, {
  message: 'must be 32 bytes in base64',
});

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

/** On this machine, or over TLS: the participant's key never travels in clear (EXT-09). */
function isLocalOrTls(value: string): boolean {
  const url = URL.parse(value);
  return url?.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(url?.hostname ?? '');
}

const schema = z
  .object({
    DATABASE_URL: postgresUrl
      // The API never runs with the migration role (API-07).
      .refine((url) => URL.parse(url)?.username !== 'nextbank_migrator', {
        message: 'must not use the nextbank_migrator role',
      }),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    // Safe default: localhost only. In a container, the deploy sets HOST=0.0.0.0.
    HOST: z.string().min(1).default('127.0.0.1'),
    // Proxies in front of the API: 0 locally, 1 behind the deploy's. Only that
    // many hops of X-Forwarded-For are believed (AUTH-01, API-02).
    TRUST_PROXY: z.coerce.number().int().min(0).max(3).default(0),
    NODE_ENV: z.string().optional(),
    // Error tracking (week 8 plan, PR c): only where a DSN is set.
    SENTRY_DSN: z.url({ protocol: /^https$/ }).optional(),
    SENTRY_ENVIRONMENT: z.string().min(1).max(64).optional(),
    // The commit the host deployed (Render sets it); names the release.
    RENDER_GIT_COMMIT: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .optional(),
    // Access token signing key (threat model D4).
    JWT_PRIVATE_KEY: z.string().refine((value) => parseEd25519PrivateKey(value) !== null, {
      message: 'must be an Ed25519 private key (PKCS#8 DER, base64)',
    }),
    JWT_KEY_ID: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
    // CPF encryption and blind index keys (database.md, section 2).
    PII_ENCRYPTION_KEY: key32,
    PII_HMAC_KEY: key32,
    PII_KEY_VERSION: z.coerce.number().int().min(1).default(1),
    // Server-side key mixed into the PIN hash (threat model API-13).
    PIN_PEPPER: key32,
    // Encrypts the top-up phone numbers, apart from the CPF (TOP-01, decision R6).
    TOP_UP_PHONE_KEY: key32,
    // The Pix to other banks (v1.2.0 plan, task 3): off until the SPI's
    // answer is handled (P1), so a customer's money never waits forever.
    EXTERNAL_PIX_ENABLED: z.enum(['true', 'false']).default('false'),
    // Where the API calls the SPI: the simulator, on 127.0.0.1 in the service (P2).
    SIMULATOR_URL: z
      .url({ protocol: /^https?$/ })
      .refine(isLocalOrTls, { message: 'must be on this machine or use https' })
      .optional(),
    // The key the API presents to the simulator, and the simulator asks (EXT-09).
    SIMULATOR_PARTICIPANT_KEY: z.string().min(32).optional(),
    // The secret the SPI's webhooks are signed with (task 4, EXT-01): the API
    // checks them, the mounted simulator signs them.
    SIMULATOR_WEBHOOK_SECRET: key32.optional(),
    // Set where the simulator is mounted in the API's service (D2), with its own role.
    SIMULATOR_DATABASE_URL: postgresUrl
      .refine((url) => URL.parse(url)?.username === 'nextbank_simulator', {
        message: 'must use the nextbank_simulator role',
      })
      .optional(),
    // The simulator's fault profile (D5, P4), read by the simulator itself.
    SIMULATOR_FAULTS: z.string().max(1_000).optional(),
  })
  .refine((env) => env.PII_HMAC_KEY !== env.PII_ENCRYPTION_KEY, {
    // One key for two purposes would let a weakness in one use expose the other.
    message: 'must differ from PII_ENCRYPTION_KEY',
    path: ['PII_HMAC_KEY'],
  })
  .refine(
    (env) => env.PIN_PEPPER !== env.PII_ENCRYPTION_KEY && env.PIN_PEPPER !== env.PII_HMAC_KEY,
    {
      message: 'must differ from the CPF keys',
      path: ['PIN_PEPPER'],
    },
  )
  .refine(
    (env) =>
      ![env.PII_ENCRYPTION_KEY, env.PII_HMAC_KEY, env.PIN_PEPPER].includes(env.TOP_UP_PHONE_KEY),
    {
      message: 'must differ from the other keys',
      path: ['TOP_UP_PHONE_KEY'],
    },
  )
  .refine(
    (env) =>
      env.EXTERNAL_PIX_ENABLED === 'false' ||
      (env.SIMULATOR_URL !== undefined &&
        env.SIMULATOR_PARTICIPANT_KEY !== undefined &&
        env.SIMULATOR_WEBHOOK_SECRET !== undefined),
    {
      message:
        'SIMULATOR_URL, SIMULATOR_PARTICIPANT_KEY and SIMULATOR_WEBHOOK_SECRET are required with EXTERNAL_PIX_ENABLED',
      path: ['EXTERNAL_PIX_ENABLED'],
    },
  )
  .refine(
    (env) =>
      env.SIMULATOR_DATABASE_URL === undefined ||
      (env.SIMULATOR_PARTICIPANT_KEY !== undefined && env.SIMULATOR_WEBHOOK_SECRET !== undefined),
    {
      message:
        'SIMULATOR_PARTICIPANT_KEY and SIMULATOR_WEBHOOK_SECRET are required with SIMULATOR_DATABASE_URL',
      path: ['SIMULATOR_DATABASE_URL'],
    },
  )
  // One secret for two purposes would let a leak of one forge the other.
  .refine(
    (env) =>
      env.SIMULATOR_WEBHOOK_SECRET === undefined ||
      env.SIMULATOR_WEBHOOK_SECRET !== env.SIMULATOR_PARTICIPANT_KEY,
    { message: 'must differ from SIMULATOR_PARTICIPANT_KEY', path: ['SIMULATOR_WEBHOOK_SECRET'] },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      env.SIMULATOR_DATABASE_URL === undefined ||
      URL.parse(env.SIMULATOR_DATABASE_URL)?.searchParams.get('sslmode') === 'verify-full',
    { message: 'must use sslmode=verify-full in production', path: ['SIMULATOR_DATABASE_URL'] },
  )
  // ADR 0009: in production the database certificate is always checked.
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      URL.parse(env.DATABASE_URL)?.searchParams.get('sslmode') === 'verify-full',
    { message: 'must use sslmode=verify-full in production', path: ['DATABASE_URL'] },
  );

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  trustProxy: number;
  /** The commit running, when the host tells it. */
  release?: string;
  /** Where unexpected errors go, when a DSN is set. */
  sentry?: { dsn: string; environment: string };
  jwt: { privateKey: KeyObject; keyId: string };
  pii: { encryptionKey: Buffer; hmacKey: Buffer; keyVersion: number };
  pinPepper: Buffer;
  /** Encrypts the top-up phone numbers (TOP-01, decision R6). */
  topUpPhoneKey: Buffer;
  /** The Pix to other banks, when on (P1). */
  externalPix?: { simulatorUrl: string; participantKey: string; webhookSecret: Buffer };
  /** The simulator mounted in the service (D2), when its database is set. */
  simulator?: {
    databaseUrl: string;
    participantKey: string;
    webhookSecret: Buffer;
    faults?: string;
  };
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
  const data = result.data;
  return {
    databaseUrl: data.DATABASE_URL,
    port: data.PORT,
    host: data.HOST,
    trustProxy: data.TRUST_PROXY,
    ...(data.RENDER_GIT_COMMIT ? { release: data.RENDER_GIT_COMMIT } : {}),
    ...(data.SENTRY_DSN
      ? {
          sentry: {
            dsn: data.SENTRY_DSN,
            environment: data.SENTRY_ENVIRONMENT ?? data.NODE_ENV ?? 'development',
          },
        }
      : {}),
    jwt: {
      privateKey: required(parseEd25519PrivateKey(data.JWT_PRIVATE_KEY)),
      keyId: data.JWT_KEY_ID,
    },
    pii: {
      encryptionKey: required(decodeBase64(data.PII_ENCRYPTION_KEY)),
      hmacKey: required(decodeBase64(data.PII_HMAC_KEY)),
      keyVersion: data.PII_KEY_VERSION,
    },
    pinPepper: required(decodeBase64(data.PIN_PEPPER)),
    topUpPhoneKey: required(decodeBase64(data.TOP_UP_PHONE_KEY)),
    ...(data.EXTERNAL_PIX_ENABLED === 'true'
      ? {
          externalPix: {
            simulatorUrl: required(data.SIMULATOR_URL ?? null),
            participantKey: required(data.SIMULATOR_PARTICIPANT_KEY ?? null),
            webhookSecret: required(decodeBase64(data.SIMULATOR_WEBHOOK_SECRET ?? '')),
          },
        }
      : {}),
    ...(data.SIMULATOR_DATABASE_URL
      ? {
          simulator: {
            databaseUrl: data.SIMULATOR_DATABASE_URL,
            participantKey: required(data.SIMULATOR_PARTICIPANT_KEY ?? null),
            webhookSecret: required(decodeBase64(data.SIMULATOR_WEBHOOK_SECRET ?? '')),
            ...(data.SIMULATOR_FAULTS ? { faults: data.SIMULATOR_FAULTS } : {}),
          },
        }
      : {}),
  };
}

/** Values already validated by the schema; reaching null here is a bug. */
function required<T>(value: T | null): T {
  if (value === null) throw new ConfigError('Invalid configuration');
  return value;
}
