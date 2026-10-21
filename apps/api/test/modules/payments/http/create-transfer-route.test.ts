import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// POST /v1/pix/transfers against the real database (domain-model.md 4; ADR
// 0007; PIX-02, PIX-04; T-DB-06; AUTH-04; READ-02; API-04).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

async function newCustomer(name = 'Marina Costa') {
  const cpf = fictitiousCpf();
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name, email, cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.3.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return { accessToken: response.json<{ accessToken: string }>().accessToken, cpf, email };
}

function create(
  accessToken: string,
  payload: Record<string, unknown>,
  idempotencyKey: string | null = randomUUID(),
) {
  const headers: Record<string, string> = { authorization: `Bearer ${accessToken}` };
  if (idempotencyKey !== null) headers['idempotency-key'] = idempotencyKey;
  return app.inject({ method: 'POST', url: '/v1/pix/transfers', payload, headers });
}

const pixTo = (cpf: string, amount: unknown = 8_000) => ({
  key: { type: 'CPF', value: cpf },
  amount: { amount, currency: 'BRL' },
  description: 'Almoço',
});

async function transfersOf(email: string): Promise<number | undefined> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM payments.pix_transfers t
     JOIN accounts.accounts a ON a.id = t.payer_account_id
     JOIN identity.users u ON u.id = a.holder_user_id WHERE u.email = $1`,
    [email],
  );
  return rows[0]?.n;
}

describe('POST /v1/pix/transfers', () => {
  it('creates the Pix awaiting the PIN, with exactly the approved fields (READ-02)', async () => {
    const payer = await newCustomer('Ana Souza');
    const payee = await newCustomer('Marina Costa');
    const digits = payee.cpf.replace(/\D/g, '');
    const masked = `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;

    const response = await create(payer.accessToken, pixTo(payee.cpf));

    expect(response.statusCode).toBe(201);
    const body = response.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual([
      'amount',
      'completedAt',
      'createdAt',
      'description',
      'endToEndId',
      'expiresAt',
      'failureReason',
      'id',
      'payee',
      'status',
    ]);
    expect(body).toMatchObject({
      status: 'AWAITING_AUTH',
      amount: { amount: 8_000, currency: 'BRL' },
      description: 'Almoço',
      payee: { name: 'Marina Costa', documentMasked: masked, keyType: 'CPF', keyMasked: masked },
      endToEndId: null,
      failureReason: null,
      completedAt: null,
    });
  });

  // PIX-02: a lost answer is retried with the same key and creates nothing more.
  it('answers a repeated request with the same response and one Pix', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    const key = randomUUID();

    const first = await create(payer.accessToken, pixTo(payee.cpf), key);
    const again = await create(payer.accessToken, pixTo(payee.cpf), key);

    expect(again.statusCode).toBe(201);
    expect(again.json()).toEqual(first.json());
    expect(await transfersOf(payer.email)).toBe(1);
  });

  // T-DB-06: requests with the same key fired at once still create one Pix.
  it('creates one Pix for 10 simultaneous requests with the same key', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    const key = randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => create(payer.accessToken, pixTo(payee.cpf), key)),
    );

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(201));
    expect(new Set(responses.map((r) => r.json<{ id: string }>().id)).size).toBe(1);
    expect(await transfersOf(payer.email)).toBe(1);
  });

  it('refuses the same key with another request (IdempotencyKeyReused)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    const key = randomUUID();
    await create(payer.accessToken, pixTo(payee.cpf), key);

    const response = await create(payer.accessToken, pixTo(payee.cpf, 9_000), key);

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('IdempotencyKeyReused');
  });

  it.each([[null], ['not-a-uuid']])(
    'requires an Idempotency-Key that is a UUID (%s)',
    async (key) => {
      const payer = await newCustomer();
      const payee = await newCustomer();

      const response = await create(payer.accessToken, pixTo(payee.cpf), key);

      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
    },
  );

  // PIX-04: tampered amounts and fields never become a Pix.
  it.each([[-1], [0], [0.001], [1e20], ['100']])('refuses the amount %j', async (amount) => {
    const payer = await newCustomer();
    const payee = await newCustomer();

    const response = await create(payer.accessToken, pixTo(payee.cpf, amount));

    expect(response.statusCode).toBe(422);
    expect(await transfersOf(payer.email)).toBe(0);
  });

  it('refuses fields the client must never send (payer account, status)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();

    for (const extra of [{ payerAccountId: randomUUID() }, { status: 'COMPLETED' }]) {
      const response = await create(payer.accessToken, { ...pixTo(payee.cpf), ...extra });
      expect(response.statusCode).toBe(422);
      expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
    }
  });

  it('refuses a description longer than 140 characters', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();

    const response = await create(payer.accessToken, {
      ...pixTo(payee.cpf),
      description: 'x'.repeat(141),
    });

    expect(response.statusCode).toBe(422);
  });

  it('refuses an amount above any limit, saying which (LimitExceeded)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();

    const response = await create(payer.accessToken, pixTo(payee.cpf, 600_000));

    expect(response.statusCode).toBe(422);
    const body = response.json<{ code: string; limit: { amount: number; currency: string } }>();
    expect(body.code).toBe('LimitExceeded');
    expect([100_000, 500_000]).toContain(body.limit.amount);
    expect(body.limit.currency).toBe('BRL');
  });

  it('refuses a Pix to the payer itself (SamePayerAndPayee)', async () => {
    const payer = await newCustomer();

    const response = await create(payer.accessToken, pixTo(payer.cpf));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('SamePayerAndPayee');
  });

  it('finds no key for an unknown CPF (PixKeyNotFound)', async () => {
    const payer = await newCustomer();

    const response = await create(payer.accessToken, pixTo('111.444.777-35'));

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('PixKeyNotFound');
  });

  it('refuses a Pix from a blocked account (AccountBlocked)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    await pool.query(
      `UPDATE accounts.accounts SET status = 'BLOCKED'
       WHERE holder_user_id = (SELECT id FROM identity.users WHERE email = $1)`,
      [payer.email],
    );

    const response = await create(payer.accessToken, pixTo(payee.cpf));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('AccountBlocked');
  });

  it('refuses a still-valid access token of a session that already ended (AUTH-04)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${payer.accessToken}` },
    });

    const response = await create(payer.accessToken, pixTo(payee.cpf));

    expect(response.statusCode).toBe(401);
  });

  it('keeps the payee CPF out of logs and stored responses (API-04)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    const digits = payee.cpf.replace(/\D/g, '');
    const key = randomUUID();

    await create(payer.accessToken, pixTo(payee.cpf), key);

    expect(logs.raw()).not.toContain(digits);
    const { rows } = await pool.query<{ body: string; hash: Buffer }>(
      `SELECT response_body::text AS body, request_hash AS hash
       FROM platform.idempotency_records WHERE key = $1`,
      [key],
    );
    expect(rows[0]?.body).not.toContain(digits);
    expect(rows[0]?.hash).toHaveLength(32);
  });
});
