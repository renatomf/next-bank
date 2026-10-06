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
    // Access token signing key (threat model D4).
    JWT_PRIVATE_KEY: z.string().refine((value) => parseEd25519PrivateKey(value) !== null, {
      message: 'must be an Ed25519 private key (PKCS#8 DER, base64)',
    }),
    JWT_KEY_ID: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
    // CPF encryption and blind index keys (database.md, section 2).
    PII_ENCRYPTION_KEY: key32,
    PII_HMAC_KEY: key32,
    PII_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  })
  .refine((env) => env.PII_HMAC_KEY !== env.PII_ENCRYPTION_KEY, {
    // One key for two purposes would let a weakness in one use expose the other.
    message: 'must differ from PII_ENCRYPTION_KEY',
    path: ['PII_HMAC_KEY'],
  });

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  jwt: { privateKey: KeyObject; keyId: string };
  pii: { encryptionKey: Buffer; hmacKey: Buffer; keyVersion: number };
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
    jwt: {
      privateKey: required(parseEd25519PrivateKey(data.JWT_PRIVATE_KEY)),
      keyId: data.JWT_KEY_ID,
    },
    pii: {
      encryptionKey: required(decodeBase64(data.PII_ENCRYPTION_KEY)),
      hmacKey: required(decodeBase64(data.PII_HMAC_KEY)),
      keyVersion: data.PII_KEY_VERSION,
    },
  };
}

/** Values already validated by the schema; reaching null here is a bug. */
function required<T>(value: T | null): T {
  if (value === null) throw new ConfigError('Invalid configuration');
  return value;
}
