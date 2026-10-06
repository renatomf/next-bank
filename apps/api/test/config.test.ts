import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/shared/config.ts';

function ed25519PrivateKey(): string {
  return generateKeyPairSync('ed25519')
    .privateKey.export({ format: 'der', type: 'pkcs8' })
    .toString('base64');
}

const valid = {
  DATABASE_URL: 'postgres://nextbank_app:s3cr3t-value@127.0.0.1:5432/nextbank',
  PORT: '3000',
  JWT_PRIVATE_KEY: ed25519PrivateKey(),
  JWT_KEY_ID: 'key-2026-10',
  PII_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  PII_HMAC_KEY: randomBytes(32).toString('base64'),
  PIN_PEPPER: randomBytes(32).toString('base64'),
};

function withEnv(change: Record<string, string | undefined>) {
  return () => loadConfig({ ...valid, ...change });
}

describe('loadConfig', () => {
  it('reads a valid configuration', () => {
    const config = loadConfig(valid);
    expect(config.databaseUrl).toBe(valid.DATABASE_URL);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('listens on localhost only by default; the deploy sets HOST explicitly', () => {
    expect(loadConfig({ ...valid, HOST: undefined }).host).toBe('127.0.0.1');
  });

  it('uses port 3000 by default', () => {
    expect(loadConfig({ ...valid, PORT: undefined }).port).toBe(3000);
  });

  it('fails naming each missing variable', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    for (const name of [
      'DATABASE_URL',
      'JWT_PRIVATE_KEY',
      'JWT_KEY_ID',
      'PII_ENCRYPTION_KEY',
      'PII_HMAC_KEY',
      'PIN_PEPPER',
    ]) {
      expect(() => loadConfig({})).toThrow(new RegExp(name));
    }
  });

  it('never exposes the received value in the error message', () => {
    const run = withEnv({ DATABASE_URL: 'not-a-url-s3cr3t-value', PORT: 'abc' });
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/PORT/);
    expect(run).not.toThrow(/s3cr3t-value/);
    expect(run).not.toThrow(/abc/);
  });

  it('refuses the migration role URL (API-07)', () => {
    expect(
      withEnv({ DATABASE_URL: 'postgres://nextbank_migrator:x@127.0.0.1:5432/nextbank' }),
    ).toThrow(/nextbank_migrator/);
  });

  describe('access token signing key (D4)', () => {
    it('loads the Ed25519 private key and its id', () => {
      const { jwt } = loadConfig(valid);

      expect(jwt.privateKey.asymmetricKeyType).toBe('ed25519');
      expect(jwt.keyId).toBe('key-2026-10');
    });

    it('refuses a key that is not Ed25519', () => {
      const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
        .privateKey.export({ format: 'der', type: 'pkcs8' })
        .toString('base64');

      expect(withEnv({ JWT_PRIVATE_KEY: rsa })).toThrow(/JWT_PRIVATE_KEY: must be an Ed25519/);
    });

    it('refuses something that is not a key, without echoing it', () => {
      const run = withEnv({ JWT_PRIVATE_KEY: 'not-a-key-but-a-s3cr3t-value' });

      expect(run).toThrow(/JWT_PRIVATE_KEY/);
      expect(run).not.toThrow(/s3cr3t-value/);
    });

    it('accepts only a short, plain key id', () => {
      expect(withEnv({ JWT_KEY_ID: 'key id with spaces' })).toThrow(/JWT_KEY_ID/);
      expect(withEnv({ JWT_KEY_ID: 'k'.repeat(65) })).toThrow(/JWT_KEY_ID/);
    });
  });

  describe('CPF keys (database.md, section 2)', () => {
    it('loads both 32-byte keys and the key version, 1 by default', () => {
      const { pii } = loadConfig(valid);

      expect(pii.encryptionKey).toHaveLength(32);
      expect(pii.hmacKey).toHaveLength(32);
      expect(pii.keyVersion).toBe(1);
      expect(loadConfig({ ...valid, PII_KEY_VERSION: '2' }).pii.keyVersion).toBe(2);
    });

    it.each(['PII_ENCRYPTION_KEY', 'PII_HMAC_KEY'])('refuses a %s that is not 32 bytes', (name) => {
      expect(withEnv({ [name]: randomBytes(16).toString('base64') })).toThrow(
        new RegExp(`${name}: must be 32 bytes in base64`),
      );
    });

    it('refuses the same key for encryption and blind index', () => {
      expect(withEnv({ PII_HMAC_KEY: valid.PII_ENCRYPTION_KEY })).toThrow(
        /PII_HMAC_KEY: must differ from PII_ENCRYPTION_KEY/,
      );
    });

    it('refuses a key version below 1', () => {
      expect(withEnv({ PII_KEY_VERSION: '0' })).toThrow(/PII_KEY_VERSION/);
    });
  });

  describe('PIN pepper (API-13)', () => {
    it('loads the 32-byte pepper', () => {
      expect(loadConfig(valid).pinPepper).toHaveLength(32);
    });

    it('refuses a pepper that is not 32 bytes', () => {
      expect(withEnv({ PIN_PEPPER: randomBytes(16).toString('base64') })).toThrow(
        /PIN_PEPPER: must be 32 bytes in base64/,
      );
    });

    it('refuses reusing a CPF key as the pepper', () => {
      expect(withEnv({ PIN_PEPPER: valid.PII_ENCRYPTION_KEY })).toThrow(
        /PIN_PEPPER: must differ from the CPF keys/,
      );
      expect(withEnv({ PIN_PEPPER: valid.PII_HMAC_KEY })).toThrow(
        /PIN_PEPPER: must differ from the CPF keys/,
      );
    });
  });
});
