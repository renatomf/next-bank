import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// GET /v1/me against the real database and keys: the app learns the customer's
// name and whether the PIN step is still pending (week 4 plan, task 1; READ-02).
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

/** The masked CPF the server keeps, as the receipts show it: "***.456.789-**". */
function maskedOf(cpf: string): string {
  const digits = cpf.replace(/D/g, '');
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

let lastCpf = '';

async function newCustomer(name: string): Promise<string> {
  lastCpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name,
      email: uniqueEmail(),
      cpf: lastCpf,
      password: 'violet staple orbit 42',
    },
    remoteAddress: `198.18.1.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ accessToken: string }>().accessToken;
}

function getMe(accessToken: string | undefined, url = '/v1/me') {
  return app.inject({
    method: 'GET',
    url,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

describe('GET /v1/me', () => {
  // v1.1.0 plan, task 4.2 (developer's call): the Home's CPF line shows the
  // CPF masked by the server, never the full one (READ-02).
  it('returns only the name, the masked CPF and whether the PIN exists', async () => {
    const accessToken = await newCustomer('Maria Teste');

    const response = await getMe(accessToken);

    expect(response.statusCode).toBe(200);
    // Exact keys: nothing else about the customer leaves the API (READ-02).
    expect(response.json()).toStrictEqual({
      name: 'Maria Teste',
      cpfMasked: maskedOf(lastCpf),
      hasPin: false,
    });
    expect(response.body).not.toContain(lastCpf.replace(/D/g, ''));
  });

  it('reports the PIN after it is created', async () => {
    const accessToken = await newCustomer('Joana Teste');
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin: '2580' },
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(created.statusCode).toBe(204);

    const response = await getMe(accessToken);

    expect(response.json()).toStrictEqual({
      name: 'Joana Teste',
      cpfMasked: maskedOf(lastCpf),
      hasPin: true,
    });
  });

  it('answers each customer with their own profile', async () => {
    const maria = await newCustomer('Maria Teste');
    const bruno = await newCustomer('Bruno Teste');

    expect((await getMe(maria)).json()).toMatchObject({ name: 'Maria Teste' });
    expect((await getMe(bruno)).json()).toMatchObject({ name: 'Bruno Teste' });
  });

  it('requires a token (deny by default)', async () => {
    const response = await getMe(undefined);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('Unauthenticated');
  });

  it('refuses query parameters: the user always comes from the token (READ-01)', async () => {
    const accessToken = await newCustomer('Maria Teste');

    const response = await getMe(accessToken, '/v1/me?userId=someone-else');

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });
});
