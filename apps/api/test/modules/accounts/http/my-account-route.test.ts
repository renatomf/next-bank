import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// GET /v1/me/account against the real database (week 4 plan, task 3; READ-01,
// READ-02, READ-05): each customer sees only their own account, and nothing
// the client sends can point to another one.
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security: testSecurity() });
});

afterAll(async () => {
  await app.close();
});

interface Customer {
  accessToken: string;
  accountId: string;
  number: string;
}

async function newCustomer(): Promise<Customer> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email,
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: `198.18.2.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  const { rows } = await pool.query<{ id: string; number: string }>(
    `SELECT a.id, a.number FROM accounts.accounts a
       JOIN identity.users u ON u.id = a.holder_user_id
      WHERE u.email = $1`,
    [email],
  );
  return { accessToken, accountId: rows[0]?.id ?? '', number: rows[0]?.number ?? '' };
}

function getMyAccount(accessToken: string | undefined, url = '/v1/me/account') {
  return app.inject({
    method: 'GET',
    url,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

describe('GET /v1/me/account', () => {
  it('returns the account and its available balance, with only the approved fields', async () => {
    const maria = await newCustomer();

    const response = await getMyAccount(maria.accessToken);

    expect(response.statusCode).toBe(200);
    // Exact keys: no id, holder, posted balance or anything else (READ-02).
    expect(response.json()).toStrictEqual({
      branch: '0001',
      number: maria.number,
      status: 'ACTIVE',
      availableBalance: { amount: 1_000_000, currency: 'BRL' },
    });
  });

  // READ-01: A and B both exist; A's token only ever reaches A's account.
  it("never shows another customer's account", async () => {
    const ana = await newCustomer();
    const bruno = await newCustomer();

    const forAna = await getMyAccount(ana.accessToken);
    const forBruno = await getMyAccount(bruno.accessToken);

    expect(forAna.json<{ number: string }>().number).toBe(ana.number);
    expect(forBruno.json<{ number: string }>().number).toBe(bruno.number);
    expect(ana.number).not.toBe(bruno.number);
  });

  it('refuses any parameter, so a client cannot point to another account (READ-01, READ-05)', async () => {
    const ana = await newCustomer();
    const bruno = await newCustomer();

    for (const query of [`accountId=${bruno.accountId}`, `number=${bruno.number}`]) {
      const response = await getMyAccount(ana.accessToken, `/v1/me/account?${query}`);

      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
    }
  });

  it('requires a token (deny by default)', async () => {
    const response = await getMyAccount(undefined);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('Unauthenticated');
  });

  it('answers NotFound for a user without an account', async () => {
    const maria = await newCustomer();
    // Like a user from before accounts existed. Only the table owner can
    // delete an account; the API role cannot.
    const owner = createPool(testMigrationDatabaseUrl());
    try {
      await owner.query('DELETE FROM accounts.accounts WHERE id = $1', [maria.accountId]);
    } finally {
      await owner.end();
    }

    const response = await getMyAccount(maria.accessToken);

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('NotFound');
  });
});
