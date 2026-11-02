import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { registerStaffAuthentication } from '../../../../src/modules/staff/index.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { staffCreator } from '../../../../scripts/create-staff.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// The staff's door into the API (v1.3.0 plan, task 1), against the real
// Postgres, keys and Argon2id: password and TOTP in one step (STF-01), every
// /admin route behind a declared permission (STF-02), a session that ends
// (STF-06), and /admin open only to the backoffice's server, with its own
// credential and a session no customer token passes for (STF-08).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
const clock = new FixedClock(new Date());
const creator = staffCreator({ pool, totpKey: TOTP_KEY, clock });
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({
    pool,
    logStream: logs.stream,
    security: testSecurity(),
    backoffice: { apiKey: BACKOFFICE_KEY, totpKey: TOTP_KEY },
    clock,
  });
});
// Closing the app ends the pool too.
afterAll(async () => {
  await app.close();
});
beforeEach(() => {
  clock.current = new Date();
});

interface Member {
  email: string;
  password: string;
  totp: TOTP;
}

async function newMember(role: 'OPERATOR' | 'ANALYST' | 'ADMIN' = 'OPERATOR'): Promise<Member> {
  const created = await creator.execute({
    email: uniqueEmail(),
    name: 'Lia Operadora',
    role,
    isDemo: false,
  });
  return {
    email: created.email,
    password: created.password,
    totp: new TOTP({ secret: Secret.fromBase32(created.totpSecret) }),
  };
}

const codeOf = (member: Member) => member.totp.generate({ timestamp: clock.now().getTime() });

function login(member: Member, overrides: Record<string, string> = {}, key = BACKOFFICE_KEY) {
  return app.inject({
    method: 'POST',
    url: '/admin/v1/auth/login',
    headers: { 'x-backoffice-key': key },
    payload: {
      email: member.email,
      password: member.password,
      mfaCode: codeOf(member),
      ...overrides,
    },
  });
}

async function signedIn(member?: Member): Promise<string> {
  const response = await login(member ?? (await newMember()));
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ token: string }>().token;
}

const me = (token: string, key = BACKOFFICE_KEY) =>
  app.inject({
    method: 'GET',
    url: '/admin/v1/me',
    headers: { 'x-backoffice-key': key, authorization: `Bearer ${token}` },
  });

describe('POST /admin/v1/auth/login', () => {
  it('opens a session with the password and the code of the authenticator', async () => {
    const member = await newMember('ANALYST');

    const response = await login(member);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as string,
      expiresAt: new Date(clock.now().getTime() + 8 * 60 * 60_000).toISOString(),
      member: { name: 'Lia Operadora', role: 'ANALYST' },
    });
  });

  it.each([
    ['a wrong code', { mfaCode: '000000' }],
    ['a wrong password', { password: 'not the password at all' }],
    ['an unknown e-mail', { email: 'nobody.staff@example.com' }],
  ])('refuses %s with the same answer (STF-01)', async (_case, overrides) => {
    const response = await login(await newMember(), overrides);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('InvalidCredentials');
  });

  it('takes a code once: the same code again is refused (RFC 6238, 5.2)', async () => {
    const member = await newMember();
    const code = codeOf(member);
    expect((await login(member, { mfaCode: code })).statusCode).toBe(200);

    expect((await login(member, { mfaCode: code })).statusCode).toBe(401);
  });

  it('opens one session when the same code comes twice at the same time', async () => {
    const member = await newMember();
    const code = codeOf(member);

    const answers = await Promise.all([
      login(member, { mfaCode: code }),
      login(member, { mfaCode: code }),
    ]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 401]);
  });

  it('blocks the e-mail after 5 wrong attempts in a minute (AUTH-01)', async () => {
    const member = await newMember();
    for (let i = 0; i < 5; i += 1) await login(member, { mfaCode: '000000' });

    const blocked = await login(member);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ code: string }>().code).toBe('TooManyAttempts');
  });

  it('refuses unknown fields', async () => {
    const response = await login(await newMember(), { role: 'ADMIN' });

    expect(response.statusCode).toBe(422);
  });

  it('never logs the password, the code or the session (API-04)', async () => {
    const member = await newMember();
    const code = codeOf(member);
    const token = (await login(member, { mfaCode: code })).json<{ token: string }>().token;

    const logged = logs.raw();
    // The code quoted, as a leaked field would be: six digits alone can turn
    // up inside a duration by chance (F-41).
    for (const secret of [member.password, `"${code}"`, token]) {
      expect(logged).not.toContain(secret);
    }
  });
});

// STF-08: /admin answers only the backoffice's server.
describe('the credential of the backoffice', () => {
  it.each([
    ['missing', undefined],
    ['wrong', randomBytes(32).toString('base64')],
  ])('refuses a %s key, even on the login', async (_case, key) => {
    const member = await newMember();
    const response = await app.inject({
      method: 'POST',
      url: '/admin/v1/auth/login',
      headers: key === undefined ? {} : { 'x-backoffice-key': key },
      payload: { email: member.email, password: member.password, mfaCode: codeOf(member) },
    });

    expect(response.statusCode).toBe(401);
  });

  it('refuses a session presented with a wrong key', async () => {
    const token = await signedIn();

    expect((await me(token, randomBytes(32).toString('base64'))).statusCode).toBe(401);
  });

  it('leaves out every /admin route when the API runs without the backoffice', async () => {
    const plain = buildApp({ pool: createPool(testDatabaseUrl()), security: testSecurity() });
    try {
      const response = await plain.inject({
        method: 'POST',
        url: '/admin/v1/auth/login',
        headers: { 'x-backoffice-key': BACKOFFICE_KEY },
        payload: {},
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await plain.close();
    }
  });
});

describe('the session of the staff', () => {
  it('shows the member it belongs to', async () => {
    const response = await me(await signedIn(await newMember('ADMIN')));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'Lia Operadora', role: 'ADMIN' });
  });

  it('ends after 15 minutes without use (STF-06)', async () => {
    const token = await signedIn();
    clock.current = new Date(clock.now().getTime() + 15 * 60_000);

    const response = await me(token);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('StaffSessionExpired');
  });

  it('ends at logout', async () => {
    const token = await signedIn();
    const out = await app.inject({
      method: 'POST',
      url: '/admin/v1/auth/logout',
      headers: { 'x-backoffice-key': BACKOFFICE_KEY, authorization: `Bearer ${token}` },
    });

    expect(out.statusCode).toBe(204);
    expect((await me(token)).statusCode).toBe(401);
  });
});

// STF-08: a customer's token never opens /admin, a staff session never the app.
describe('customers and staff never cross', () => {
  async function customerToken(): Promise<string> {
    const registered = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      remoteAddress: `198.18.60.${String(nextIp++)}`,
      payload: {
        name: 'Maria Teste',
        email: uniqueEmail(),
        cpf: fictitiousCpf(),
        password: 'violet staple orbit 42',
      },
    });
    return registered.json<{ accessToken: string }>().accessToken;
  }

  it("refuses a customer's token on /admin", async () => {
    expect((await me(await customerToken())).statusCode).toBe(401);
  });

  it('refuses a staff session on the routes of the app', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${await signedIn()}` },
    });

    expect(response.statusCode).toBe(401);
  });
});

// STF-02: deny by default. A route of the staff without a permission never starts.
describe('the permission of every /admin route', () => {
  it('refuses to start a staff route that declares no permission', async () => {
    const server = Fastify();
    void server.register((scope) => {
      registerStaffAuthentication(scope, {
        apiKey: BACKOFFICE_KEY,
        authenticate: () => Promise.reject(new Error('unused')),
      });
      scope.get('/forgotten', () => ({ ok: true }));
      return Promise.resolve();
    });

    await expect(server.ready()).rejects.toThrow(/permission/);
    await server.close();
  });

  it('starts the real ones: each of them declares its permission', async () => {
    await expect(app.ready()).resolves.toBeDefined();
  });
});
