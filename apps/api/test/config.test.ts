import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.ts';

const valid = {
  DATABASE_URL: 'postgres://nextbank_app:s3cr3t-value@127.0.0.1:5432/nextbank',
  PORT: '3000',
};

describe('loadConfig', () => {
  it('reads a valid configuration', () => {
    const config = loadConfig(valid);
    expect(config.databaseUrl).toBe(valid.DATABASE_URL);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('listens on localhost only by default; the deploy sets HOST explicitly', () => {
    expect(loadConfig({ DATABASE_URL: valid.DATABASE_URL }).host).toBe('127.0.0.1');
  });

  it('uses port 3000 by default', () => {
    expect(loadConfig({ DATABASE_URL: valid.DATABASE_URL }).port).toBe(3000);
  });

  it('fails naming the missing variable', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('never exposes the received value in the error message', () => {
    const run = () => loadConfig({ DATABASE_URL: 'not-a-url-s3cr3t-value', PORT: 'abc' });
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/PORT/);
    expect(run).not.toThrow(/s3cr3t-value/);
    expect(run).not.toThrow(/abc/);
  });

  it('refuses the migration role URL (API-07)', () => {
    const run = () =>
      loadConfig({ DATABASE_URL: 'postgres://nextbank_migrator:x@127.0.0.1:5432/nextbank' });
    expect(run).toThrow(/nextbank_migrator/);
  });
});
