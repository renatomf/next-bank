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

const schema = z
  .object({
    DATABASE_URL: z
      .url({ protocol: /^postgres(ql)?$/ })
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
  };
}

/** Values already validated by the schema; reaching null here is a bug. */
function required<T>(value: T | null): T {
  if (value === null) throw new ConfigError('Invalid configuration');
  return value;
}
