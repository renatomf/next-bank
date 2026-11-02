import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { DEMO_STAFF, seedDemoStaff, staffCreator } from '../../../../scripts/create-staff.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// The customers in the backoffice (v1.3.0 plan, task 3), against the real
// Postgres: masked reads, each one audited (STF-07), only for the roles that
// read customers (C1, STF-02), and the demo staff kept to the demo customers
// (B5, STF-11). The term searched never sits in a URL or a log (C2, READ-06).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const PASSWORD = 'violet staple orbit 42';
const pool = createPool(testDatabaseUrl());
const migrator = createPool(testMigrationDatabaseUrl());
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
afterAll(async () => {
  await app.close();
  await migrator.end();
});

type Role = 'OPERATOR' | 'ANALYST' | 'ADMIN';

/** A staff member signed in: the token and the member's id. */
async function staff(role: Role, isDemo = false): Promise<{ token: string; memberId: string }> {
  const created = await creator.execute({
    email: uniqueEmail(),
    name: 'Lia Equipe',
    role,
    isDemo,
  });
  const totp = new TOTP({ secret: Secret.fromBase32(created.totpSecret) });
  const response = await app.inject({
    method: 'POST',
    url: '/admin/v1/auth/login',
    headers: { 'x-backoffice-key': BACKOFFICE_KEY },
    payload: {
      email: created.email,
      password: created.password,
      mfaCode: totp.generate({ timestamp: clock.now().getTime() }),
    },
  });
  expect(response.statusCode, response.body).toBe(200);
  return { token: response.json<{ token: string }>().token, memberId: created.id };
}

interface Customer {
  id: string;
  name: string;
  email: string;
  cpf: string;
  number: string;
}

/** A customer registered through the app; a demo one is marked as the seed does. */
async function customer(options: { name?: string; demo?: boolean } = {}): Promise<Customer> {
  const name = options.name ?? `Clara ${randomUUID().slice(0, 8)}`;
  const email = uniqueEmail();
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name, email, cpf, password: PASSWORD },
    remoteAddress: `198.18.9.${String(nextIp++)}`,
  });
  expect(response.statusCode, response.body).toBe(201);
  if (options.demo === true) {
    await migrator.query('UPDATE identity.users SET is_demo = true WHERE email = $1', [email]);
  }
  const { rows } = await pool.query<{ id: string; number: string }>(
    `SELECT u.id, a.number FROM identity.users u
     JOIN accounts.accounts a ON a.holder_user_id = u.id WHERE u.email = $1`,
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error('customer not registered');
  return { id: row.id, name, email, cpf, number: row.number };
}

const masked = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;

const headers = (token: string) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
});

const search = (token: string, query: string) =>
  app.inject({
    method: 'POST',
    url: '/admin/v1/customers/search',
    headers: headers(token),
    payload: { query },
  });

const found = (response: Awaited<ReturnType<typeof search>>) =>
  response.json<{ customers: { id: string }[] }>().customers.map((c) => c.id);

const card = (token: string, id: string) =>
  app.inject({ method: 'GET', url: `/admin/v1/customers/${id}`, headers: headers(token) });

const statement = (token: string, id: string, cursor?: string) =>
  app.inject({
    method: 'GET',
    url: `/admin/v1/customers/${id}/statement${cursor === undefined ? '' : `?cursor=${cursor}`}`,
    headers: headers(token),
  });

/** The customer reads written about a subject: a customer or a member. */
async function auditOf(subjectId: string) {
  const { rows } = await pool.query<{
    actor_type: string;
    actor_id: string;
    action: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT actor_type, actor_id, action, metadata FROM audit.audit_events
     WHERE subject_id = $1 AND action IN ('SENSITIVE_DATA_ACCESSED', 'CUSTOMERS_SEARCHED')
     ORDER BY occurred_at, id`,
    [subjectId],
  );
  return rows;
}

describe('POST /admin/v1/customers/search', () => {
  it.each([
    ['the CPF', (c: Customer) => c.cpf],
    ['the e-mail', (c: Customer) => c.email.toUpperCase()],
    ['the account number', (c: Customer) => c.number],
    ['the start of the name', (c: Customer) => c.name.toLowerCase()],
  ])('finds a customer by %s, masked', async (_case, termOf) => {
    const { token } = await staff('OPERATOR');
    const customerFound = await customer();

    const response = await search(token, termOf(customerFound));

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      customers: [
        {
          id: customerFound.id,
          name: customerFound.name,
          cpfMasked: masked(customerFound.cpf),
          emailMasked: 'u***@example.test',
          status: 'ACTIVE',
          account: { branch: '0001', number: customerFound.number, status: 'ACTIVE' },
        },
      ],
      truncated: false,
    });
  });

  it('takes % and _ as letters, never as wildcards (READ-04)', async () => {
    const { token } = await staff('ANALYST');
    await customer();

    expect(found(await search(token, '%%%'))).toEqual([]);
    expect(found(await search(token, '___'))).toEqual([]);
  });

  it('finds a name that holds % and _ by those very letters', async () => {
    const { token } = await staff('ANALYST');
    const unusual = await customer({ name: `Zé_100%_${randomUUID().slice(0, 8)}` });

    expect(found(await search(token, unusual.name))).toEqual([unusual.id]);
  });

  it('writes one event per search, never the term (C3)', async () => {
    const { token, memberId } = await staff('ANALYST');
    const customerFound = await customer();

    await search(token, customerFound.email);

    expect(await auditOf(memberId)).toEqual([
      {
        actor_type: 'STAFF',
        actor_id: memberId,
        action: 'CUSTOMERS_SEARCHED',
        metadata: { by: 'EMAIL', results: 1 },
      },
    ]);
  });

  it('never logs the term searched (READ-06)', async () => {
    const { token } = await staff('OPERATOR');
    const customerFound = await customer();

    await search(token, customerFound.cpf);

    expect(logs.raw()).not.toContain(customerFound.cpf);
  });

  it.each(['an', '', 'x'.repeat(121)])('refuses the term %j (422)', async (query) => {
    const { token } = await staff('OPERATOR');

    expect((await search(token, query)).statusCode).toBe(422);
  });
});

describe('GET /admin/v1/customers/{customerId}', () => {
  it('answers the card masked, with the balance, and audits the access (STF-07)', async () => {
    const { token, memberId } = await staff('ANALYST');
    const customerFound = await customer();

    const response = await card(token, customerFound.id);

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      id: customerFound.id,
      name: customerFound.name,
      cpfMasked: masked(customerFound.cpf),
      emailMasked: 'u***@example.test',
      status: 'ACTIVE',
      account: {
        branch: '0001',
        number: customerFound.number,
        status: 'ACTIVE',
        openedAt: expect.any(String) as string,
      },
      // The demo funding every new account receives.
      balance: expect.objectContaining({ currency: 'BRL' }) as unknown,
    });
    expect(await auditOf(customerFound.id)).toEqual([
      {
        actor_type: 'STAFF',
        actor_id: memberId,
        action: 'SENSITIVE_DATA_ACCESSED',
        metadata: { view: 'CUSTOMER' },
      },
    ]);
  });

  it('answers a name with a script as data, as it was written (STF-05)', async () => {
    const { token } = await staff('OPERATOR');
    const customerFound = await customer({ name: '<script>alert(1)</script>' });

    const response = await card(token, customerFound.id);

    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json<{ name: string }>().name).toBe('<script>alert(1)</script>');
  });

  it('answers 404 for an unknown customer and 422 for an id that is not one', async () => {
    const { token } = await staff('OPERATOR');

    expect((await card(token, randomUUID())).statusCode).toBe(404);
    expect((await card(token, 'not-a-uuid')).statusCode).toBe(422);
  });
});

describe('GET /admin/v1/customers/{customerId}/statement', () => {
  it("reads the customer's statement and audits the access", async () => {
    const { token, memberId } = await staff('OPERATOR');
    const customerFound = await customer();

    const response = await statement(token, customerFound.id);

    expect(response.statusCode, response.body).toBe(200);
    const page = response.json<{ items: { kind: string }[]; nextCursor: string | null }>();
    expect(page.items.map((item) => item.kind)).toEqual(['DEMO_FUNDING']);
    expect(page.nextCursor).toBeNull();
    expect(await auditOf(customerFound.id)).toEqual([
      {
        actor_type: 'STAFF',
        actor_id: memberId,
        action: 'SENSITIVE_DATA_ACCESSED',
        metadata: { view: 'STATEMENT' },
      },
    ]);
  });

  it('refuses a forged cursor (READ-03)', async () => {
    const { token } = await staff('OPERATOR');
    const customerFound = await customer();

    expect((await statement(token, customerFound.id, 'bm90LWEtY3Vyc29y')).statusCode).toBe(422);
  });
});

// B5, STF-11: the demo staff's credentials are public; the scope is the server's.
describe('the demo staff', () => {
  it('sees the demo customers', async () => {
    const { token } = await staff('OPERATOR', true);
    const demo = await customer({ demo: true });

    expect((await card(token, demo.id)).statusCode).toBe(200);
    expect((await statement(token, demo.id)).statusCode).toBe(200);
    expect(found(await search(token, demo.email))).toEqual([demo.id]);
  });

  it("never sees a visitor's registration, by any door", async () => {
    const { token } = await staff('ANALYST', true);
    const visitor = await customer();

    expect((await card(token, visitor.id)).statusCode).toBe(404);
    expect((await statement(token, visitor.id)).statusCode).toBe(404);
    for (const term of [visitor.email, visitor.cpf, visitor.number, visitor.name]) {
      expect(found(await search(token, term))).toEqual([]);
    }
    expect(await auditOf(visitor.id)).toEqual([]);
  });
});

// C5: the demo staff of the README, recreated at every reset with its
// published credentials, signs in and stays inside the demo.
describe('the published demo staff', () => {
  it('signs in with the credentials of the README and reads only demo customers', async () => {
    await seedDemoStaff(creator);
    const visitor = await customer();

    for (const member of DEMO_STAFF) {
      const totp = new TOTP({ secret: Secret.fromBase32(member.totpSecret) });
      const login = await app.inject({
        method: 'POST',
        url: '/admin/v1/auth/login',
        headers: { 'x-backoffice-key': BACKOFFICE_KEY },
        payload: {
          email: member.email,
          password: member.password,
          mfaCode: totp.generate({ timestamp: clock.now().getTime() }),
        },
      });
      expect(login.statusCode, login.body).toBe(200);
      const { token } = login.json<{ token: string }>();

      expect((await card(token, visitor.id)).statusCode).toBe(404);
    }
    expect(DEMO_STAFF.map((member) => member.role)).toEqual(['OPERATOR', 'ANALYST']);
  });
});

// C1, STF-02: only the operator and the analyst read customers.
describe('who reads customers', () => {
  it('refuses the admin on every customer route (403)', async () => {
    const { token } = await staff('ADMIN');
    const customerFound = await customer();

    expect((await search(token, customerFound.email)).statusCode).toBe(403);
    expect((await card(token, customerFound.id)).statusCode).toBe(403);
    expect((await statement(token, customerFound.id)).statusCode).toBe(403);
    expect(await auditOf(customerFound.id)).toEqual([]);
  });

  it("refuses a customer's own token (401)", async () => {
    const customerFound = await customer();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: customerFound.email, password: PASSWORD },
      remoteAddress: `198.18.9.${String(nextIp++)}`,
    });
    const accessToken = login.json<{ accessToken: string }>().accessToken;

    expect((await card(accessToken, customerFound.id)).statusCode).toBe(401);
  });
});
