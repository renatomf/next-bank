import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// O papel da API precisa de menor privilégio real (API-07, API-11, API-12, T-DB-13).
describe('papel nextbank_app', () => {
  const client = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  it('é o papel usado pela API', async () => {
    const { rows } = await client.query<{ current_user: string }>('SELECT current_user');
    expect(rows[0]?.current_user).toBe('nextbank_app');
  });

  it('não tem atributos especiais (API-11)', async () => {
    const { rows } = await client.query<Record<string, boolean>>(
      `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows[0]).toEqual({
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
    });
  });

  it('não é membro de nenhum outro papel (API-11)', async () => {
    const { rows } = await client.query<{ roles: string[] }>(
      `SELECT coalesce(array_agg(roleid::regrole::text), '{}') AS roles
       FROM pg_auth_members WHERE member = current_user::regrole`,
    );
    expect(rows[0]?.roles).toEqual([]);
  });

  it('tem timeouts que impedem locks presos (API-12)', async () => {
    const { rows } = await client.query<Record<string, string>>(
      `SELECT current_setting('statement_timeout') AS statement,
              current_setting('lock_timeout') AS lock,
              current_setting('idle_in_transaction_session_timeout') AS idle`,
    );
    expect(rows[0]).toEqual({ statement: '5s', lock: '3s', idle: '10s' });
  });

  it('não executa DDL (T-DB-13)', async () => {
    await expect(client.query('CREATE TABLE public.intruder (id int)')).rejects.toThrow(
      /permission denied/,
    );
    await expect(client.query('CREATE SCHEMA intruder')).rejects.toThrow(/permission denied/);
  });
});
