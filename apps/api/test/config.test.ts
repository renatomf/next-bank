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
  TOP_UP_PHONE_KEY: randomBytes(32).toString('base64'),
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
      'TOP_UP_PHONE_KEY',
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

  // v1.1.0 plan, task 5 (TOP-01, decision R6): the top-up number has its own
  // encryption key, so leaking or rotating one key never touches the other.
  describe('top-up phone key', () => {
    it('loads the 32-byte key', () => {
      expect(loadConfig(valid).topUpPhoneKey).toHaveLength(32);
    });

    it('refuses a key that is not 32 bytes', () => {
      expect(withEnv({ TOP_UP_PHONE_KEY: randomBytes(16).toString('base64') })).toThrow(
        /TOP_UP_PHONE_KEY: must be 32 bytes in base64/,
      );
    });

    it('refuses reusing any other key as the phone key', () => {
      for (const other of [valid.PII_ENCRYPTION_KEY, valid.PII_HMAC_KEY, valid.PIN_PEPPER]) {
        expect(withEnv({ TOP_UP_PHONE_KEY: other })).toThrow(
          /TOP_UP_PHONE_KEY: must differ from the other keys/,
        );
      }
    });
  });

  // Week 8 plan, task 3a: behind the deploy proxy, the client is the hop
  // before it (AUTH-01, API-02).
  it('trusts no proxy by default, and the number of hops set', () => {
    expect(loadConfig(valid).trustProxy).toBe(0);
    expect(loadConfig({ ...valid, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(withEnv({ TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
    expect(withEnv({ TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  // ADR 0009: in production the database certificate is always checked.
  it('refuses production without sslmode=verify-full', () => {
    const production = { ...valid, NODE_ENV: 'production' };
    expect(() => loadConfig(production)).toThrow(/DATABASE_URL: .*verify-full/);
    expect(() =>
      loadConfig({ ...production, DATABASE_URL: `${valid.DATABASE_URL}?sslmode=require` }),
    ).toThrow(/verify-full/);
    expect(
      loadConfig({ ...production, DATABASE_URL: `${valid.DATABASE_URL}?sslmode=verify-full` })
        .databaseUrl,
    ).toContain('verify-full');
  });

  // Week 8 plan, task 3b: the host tells the commit it deployed.
  it('takes the release from the host, and none locally', () => {
    expect(loadConfig(valid).release).toBeUndefined();
    expect(
      loadConfig({ ...valid, RENDER_GIT_COMMIT: '0123abcd0123abcd0123abcd0123abcd0123abcd' })
        .release,
    ).toBe('0123abcd0123abcd0123abcd0123abcd0123abcd');
    expect(withEnv({ RENDER_GIT_COMMIT: 'not a commit' })).toThrow(/RENDER_GIT_COMMIT/);
  });

  // Week 8 plan, PR c: errors reach Sentry only where a DSN is set.
  it('reports errors only with a Sentry DSN, naming the environment', () => {
    expect(loadConfig(valid).sentry).toBeUndefined();
    expect(
      loadConfig({
        ...valid,
        SENTRY_DSN: 'https://public@o1.ingest.sentry.io/2',
        NODE_ENV: 'development',
      }).sentry,
    ).toEqual({ dsn: 'https://public@o1.ingest.sentry.io/2', environment: 'development' });
    expect(
      loadConfig({
        ...valid,
        SENTRY_DSN: 'https://public@o1.ingest.sentry.io/2',
        SENTRY_ENVIRONMENT: 'demo',
      }).sentry?.environment,
    ).toBe('demo');
    expect(withEnv({ SENTRY_DSN: 'not a url' })).toThrow(/SENTRY_DSN/);
  });

  it('keeps local development free to use a plain connection', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: 'development' })).not.toThrow();
  });

  // The Pix to other banks and the simulator mounted in the service (v1.2.0
  // plan, task 3, P1 and P2).
  describe('external Pix and simulator', () => {
    const participantKey = randomBytes(32).toString('base64');
    // The SPI's webhooks are signed with it (task 4, EXT-01).
    const webhookSecret = randomBytes(32);
    const externalPix = {
      EXTERNAL_PIX_ENABLED: 'true',
      SIMULATOR_URL: 'http://127.0.0.1:3000/simulator',
      SIMULATOR_PARTICIPANT_KEY: participantKey,
      SIMULATOR_WEBHOOK_SECRET: webhookSecret.toString('base64'),
    };
    const simulator = {
      SIMULATOR_DATABASE_URL: 'postgres://nextbank_simulator:s3cr3t-value@127.0.0.1:5432/nextbank',
      SIMULATOR_PARTICIPANT_KEY: participantKey,
      SIMULATOR_WEBHOOK_SECRET: webhookSecret.toString('base64'),
    };

    it('keeps the Pix to other banks off and mounts no simulator by default (P1)', () => {
      const config = loadConfig(valid);

      expect(config.externalPix).toBeUndefined();
      expect(config.simulator).toBeUndefined();
    });

    it('turns the Pix to other banks on with where the SPI is and the key', () => {
      expect(loadConfig({ ...valid, ...externalPix }).externalPix).toEqual({
        simulatorUrl: 'http://127.0.0.1:3000/simulator',
        participantKey,
        webhookSecret,
      });
      expect(
        loadConfig({ ...valid, ...externalPix, EXTERNAL_PIX_ENABLED: 'false' }).externalPix,
      ).toBeUndefined();
    });

    it.each(['SIMULATOR_URL', 'SIMULATOR_PARTICIPANT_KEY', 'SIMULATOR_WEBHOOK_SECRET'])(
      'refuses the Pix to other banks without %s',
      (name) => {
        expect(withEnv({ ...externalPix, [name]: undefined })).toThrow(new RegExp(name));
      },
    );

    // EXT-09: the participant's key never travels in clear off this machine.
    it('calls the SPI only on this machine or over HTTPS', () => {
      expect(
        withEnv({ ...externalPix, SIMULATOR_URL: 'http://spi.example.com/simulator' }),
      ).toThrow(/SIMULATOR_URL/);
      expect(() =>
        loadConfig({ ...valid, ...externalPix, SIMULATOR_URL: 'https://spi.example.com' }),
      ).not.toThrow();
      expect(() =>
        loadConfig({ ...valid, ...externalPix, SIMULATOR_URL: 'http://localhost:3000/simulator' }),
      ).not.toThrow();
    });

    it('refuses a webhook secret that is not 32 bytes, or that is the participant key', () => {
      expect(withEnv({ ...externalPix, SIMULATOR_WEBHOOK_SECRET: 'c2hvcnQ=' })).toThrow(
        /SIMULATOR_WEBHOOK_SECRET/,
      );
      expect(withEnv({ ...externalPix, SIMULATOR_WEBHOOK_SECRET: participantKey })).toThrow(
        /SIMULATOR_WEBHOOK_SECRET/,
      );
    });

    it('refuses a short participant key', () => {
      expect(withEnv({ ...externalPix, SIMULATOR_PARTICIPANT_KEY: 'short' })).toThrow(
        /SIMULATOR_PARTICIPANT_KEY/,
      );
    });

    it('mounts the simulator with its own database role, key and faults', () => {
      expect(
        loadConfig({ ...valid, ...simulator, SIMULATOR_FAULTS: '{"latencyMs":50}' }).simulator,
      ).toEqual({
        databaseUrl: simulator.SIMULATOR_DATABASE_URL,
        participantKey,
        webhookSecret,
        faults: '{"latencyMs":50}',
      });
      expect(withEnv({ ...simulator, SIMULATOR_PARTICIPANT_KEY: undefined })).toThrow(
        /SIMULATOR_PARTICIPANT_KEY/,
      );
      expect(withEnv({ ...simulator, SIMULATOR_WEBHOOK_SECRET: undefined })).toThrow(
        /SIMULATOR_WEBHOOK_SECRET/,
      );
    });

    it('refuses to mount the simulator with the API or the migrator role', () => {
      for (const role of ['nextbank_app', 'nextbank_migrator']) {
        expect(
          withEnv({
            ...simulator,
            SIMULATOR_DATABASE_URL: `postgres://${role}:s3cr3t-value@127.0.0.1:5432/nextbank`,
          }),
        ).toThrow(/SIMULATOR_DATABASE_URL/);
      }
    });

    it('refuses the simulator database without sslmode=verify-full in production', () => {
      const production = {
        ...simulator,
        NODE_ENV: 'production',
        DATABASE_URL: `${valid.DATABASE_URL}?sslmode=verify-full`,
      };

      expect(withEnv(production)).toThrow(/SIMULATOR_DATABASE_URL/);
      expect(() =>
        loadConfig({
          ...valid,
          ...production,
          SIMULATOR_DATABASE_URL: `${simulator.SIMULATOR_DATABASE_URL}?sslmode=verify-full`,
        }),
      ).not.toThrow();
    });
  });
});
