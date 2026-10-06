import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.ts';
import { JoseAccessTokens } from '../../../src/modules/identity/infrastructure/jose-access-tokens.ts';
import { createPool } from '../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../modules/identity/fixtures.ts';

// POST /v1/auth/register (domain-model.md, section 8), against the real database,
// keys and Argon2id. Each test uses its own client IP, so the per-IP registration
// limit (AUTH-09) only shows up where it is the subject.
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

function newIp(): string {
  return `198.51.100.${String(nextIp++)}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Maria Teste',
    email: uniqueEmail(),
    cpf: fictitiousCpf(),
    password: 'violet staple orbit 42',
    deviceLabel: 'Pixel 8',
    ...overrides,
  };
}

function register(body: Record<string, unknown>, ip = newIp(), requestId?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: body,
    remoteAddress: ip,
    headers: requestId ? { 'x-request-id': requestId } : {},
  });
}

describe('POST /v1/auth/register', () => {
  it('creates the customer and answers 201 with a working session', async () => {
    const response = await register(validBody());

    expect(response.statusCode).toBe(201);
    const body = response.json<Record<string, string>>();
    expect(body.tokenType).toBe('Bearer');
    expect(body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(body.accessTokenExpiresAt ?? '').toISOString()).toBe(body.accessTokenExpiresAt);
    const verifier = new JoseAccessTokens(security.accessTokenKeys);
    await expect(verifier.verify(body.accessToken ?? '', new Date())).resolves.toMatchObject({
      userId: expect.any(String) as string,
    });
  });

  it('answers only the four token fields: no ids, CPF, e-mail or name (READ-02)', async () => {
    const response = await register(validBody());

    expect(Object.keys(response.json<object>()).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresAt',
      'refreshToken',
      'tokenType',
    ]);
  });

  it('records the session and the audit trail with the request id', async () => {
    const requestId = '0199aaaa-0000-7000-8000-00000000c0de';
    const response = await register(validBody(), newIp(), requestId);
    const { accessToken } = response.json<{ accessToken: string }>();
    const { userId, sessionId } = await new JoseAccessTokens(security.accessTokenKeys).verify(
      accessToken,
      new Date(),
    );

    const { rows } = await pool.query<{ action: string; request_id: string }>(
      `SELECT action, request_id FROM audit.audit_events
       WHERE subject_id IN ($1, $2) ORDER BY action`,
      [userId, sessionId],
    );
    expect(rows).toEqual([
      { action: 'SESSION_CREATED', request_id: requestId },
      { action: 'USER_REGISTERED', request_id: requestId },
    ]);
  });

  it('accepts a registration without a device label', async () => {
    const body = validBody({ deviceLabel: undefined });
    const response = await register(body);

    expect(response.statusCode).toBe(201);
    const { rows } = await pool.query<{ device_label: string | null }>(
      `SELECT s.device_label FROM identity.sessions s
       JOIN identity.users u ON u.id = s.user_id WHERE u.email = $1`,
      [body.email],
    );
    expect(rows).toEqual([{ device_label: null }]);
  });

  it('never stores the CPF digits in clear (API-06)', async () => {
    const body = validBody();
    await register(body);

    const { rows } = await pool.query<{ cpf_ciphertext: Buffer }>(
      'SELECT cpf_ciphertext FROM identity.users WHERE email = $1',
      [body.email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cpf_ciphertext.includes(Buffer.from(body.cpf))).toBe(false);
  });

  it('refuses a common password (WeakPassword, AUTH-07)', async () => {
    const response = await register(validBody({ password: 'qwertyuiop' }));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('WeakPassword');
  });

  it('refuses a 10,000-character password at the border, before any hashing (AUTH-08)', async () => {
    const response = await register(validBody({ password: 'a'.repeat(10_000) }));

    expect(response.statusCode).toBe(422);
    // InvalidRequest (schema), not WeakPassword (domain): it never reached the use case.
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('refuses an invalid CPF (InvalidCpf)', async () => {
    const response = await register(validBody({ cpf: '123.456.789-00' }));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidCpf');
  });

  it.each([
    ['an unknown field', { accountId: 'someone-else' }],
    ['a name that is only spaces around one letter', { name: '  a  ' }],
    ['a name with control characters', { name: 'Maria\u0000Teste' }],
    ['an invalid e-mail', { email: 'not-an-email' }],
  ])('refuses %s (InvalidRequest, PIX-04)', async (_case, change) => {
    const response = await register(validBody(change));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('answers the same generic body for a repeated e-mail and a repeated CPF (AUTH-02)', async () => {
    const first = validBody();
    await register(first);

    const sameEmail = await register(validBody({ email: first.email }));
    const sameCpf = await register(validBody({ cpf: first.cpf }));

    expect(sameEmail.statusCode).toBe(409);
    expect(sameCpf.statusCode).toBe(409);
    expect(sameEmail.body).toBe(sameCpf.body);
    expect(sameEmail.json<{ code: string }>().code).toBe('AlreadyRegistered');
  });

  it('allows 3 registration attempts per IP per hour, then answers 429 (AUTH-09)', async () => {
    const ip = newIp();
    // Failed attempts count too: a robot testing data is limited the same way.
    expect((await register(validBody({ cpf: '123.456.789-00' }), ip)).statusCode).toBe(422);
    expect((await register(validBody(), ip)).statusCode).toBe(201);
    expect((await register(validBody(), ip)).statusCode).toBe(201);

    const blocked = await register(validBody(), ip);
    const otherClient = await register(validBody());

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('TooManyAttempts');
    expect(otherClient.statusCode).toBe(201);
  });

  it('keeps password, CPF, e-mail and name out of the logs (API-04)', async () => {
    const body = validBody({ name: 'Joana Registro' });
    await register(body);
    await register({ ...body, password: 'short' });

    const output = logs.raw();
    for (const personal of [body.password, body.cpf, body.email, body.name]) {
      expect(output).not.toContain(personal);
    }
  });
});
