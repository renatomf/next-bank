import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.ts';

const valid = {
  DATABASE_URL: 'postgres://nextbank_app:s3cr3t-value@127.0.0.1:5432/nextbank',
  PORT: '3000',
};

describe('loadConfig', () => {
  it('lê uma configuração válida', () => {
    const config = loadConfig(valid);
    expect(config.databaseUrl).toBe(valid.DATABASE_URL);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('127.0.0.1');
  });

  it('escuta só em localhost por padrão; o deploy define HOST explicitamente', () => {
    expect(loadConfig({ DATABASE_URL: valid.DATABASE_URL }).host).toBe('127.0.0.1');
  });

  it('usa a porta 3000 por padrão', () => {
    expect(loadConfig({ DATABASE_URL: valid.DATABASE_URL }).port).toBe(3000);
  });

  it('falha nomeando a variável ausente', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('nunca expõe o valor recebido na mensagem de erro', () => {
    const run = () => loadConfig({ DATABASE_URL: 'not-a-url-s3cr3t-value', PORT: 'abc' });
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/PORT/);
    expect(run).not.toThrow(/s3cr3t-value/);
    expect(run).not.toThrow(/abc/);
  });

  it('recusa a URL do papel de migração (API-07)', () => {
    const run = () =>
      loadConfig({ DATABASE_URL: 'postgres://nextbank_migrator:x@127.0.0.1:5432/nextbank' });
    expect(run).toThrow(/nextbank_migrator/);
  });
});
