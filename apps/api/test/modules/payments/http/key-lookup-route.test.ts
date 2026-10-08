import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// POST /v1/pix/key-lookups against the real database (screen 7; D2: the key
// travels in the body, never in the URL; D6; PIX-07; READ-02; API-04).
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
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name, email: uniqueEmail(), cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.2.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return { accessToken: response.json<{ accessToken: string }>().accessToken, cpf };
}

function lookUp(accessToken: string | undefined, payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/v1/pix/key-lookups',
    payload,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

describe('POST /v1/pix/key-lookups', () => {
  it('shows the payee of a CPF key with exactly the approved fields (D6, READ-02)', async () => {
    const payer = await newCustomer('Ana Souza');
    const payee = await newCustomer('Marina Costa');
    const digits = payee.cpf.replace(/\D/g, '');
    const masked = `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;

    const response = await lookUp(payer.accessToken, { type: 'CPF', value: payee.cpf });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      keyType: 'CPF',
      keyMasked: masked,
      payeeName: 'Marina Costa',
      payeeDocumentMasked: masked,
    });
  });

  it('finds no key for a CPF nobody registered (PixKeyNotFound)', async () => {
    const payer = await newCustomer();

    const response = await lookUp(payer.accessToken, { type: 'CPF', value: '111.444.777-35' });

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('PixKeyNotFound');
  });

  it('allows 30 lookups an hour per customer, then answers 429 (PIX-07)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    for (let i = 0; i < 30; i++) {
      expect((await lookUp(payer.accessToken, { type: 'CPF', value: payee.cpf })).statusCode).toBe(
        200,
      );
    }

    const response = await lookUp(payer.accessToken, { type: 'CPF', value: payee.cpf });

    expect(response.statusCode).toBe(429);
    expect(response.json<{ code: string }>().code).toBe('TooManyAttempts');
  });

  it.each([
    [{ type: 'NICKNAME', value: 'ana' }],
    [{ type: 'CPF' }],
    [{ type: 'CPF', value: '' }],
    [{ type: 'CPF', value: 'x'.repeat(78) }],
    [{ type: 'CPF', value: '12345678909', accountId: 'someone-else' }],
  ])('refuses the malformed body %j (InvalidRequest)', async (payload) => {
    const payer = await newCustomer();

    const response = await lookUp(payer.accessToken, payload);

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await lookUp(undefined, { type: 'CPF', value: '12345678909' });

    expect(response.statusCode).toBe(401);
  });

  it('keeps the CPF looked up out of the logs (API-04)', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer();
    const digits = payee.cpf.replace(/\D/g, '');

    await lookUp(payer.accessToken, { type: 'CPF', value: payee.cpf });
    await lookUp(payer.accessToken, { type: 'CPF', value: '111.444.777-35' });

    expect(logs.raw()).not.toContain(digits);
    expect(logs.raw()).not.toContain('111.444.777-35');
  });
});
