import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { staffCreator } from '../../../../scripts/create-staff.ts';
import {
  captureLogs,
  testDatabaseUrl,
  testMigrationDatabaseUrl,
  testSecurity,
} from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// Blocking and unblocking accounts (v1.3.0 plan, task 4), against the real
// Postgres: a block shuts the customer out at once and for good, closing
// F-12; an unblock needs two people, never the requester (STF-03), and
// one decision only (STF-09); each role reaches only its routes (STF-02)
// and the demo staff only the demo customers it may touch (STF-11, STF-13).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const PASSWORD = 'violet staple orbit 42';
const PIN = '2580';
const pool = createPool(testDatabaseUrl());
const migrator = createPool(testMigrationDatabaseUrl());
const clock = new FixedClock(new Date());
const creator = staffCreator({ pool, totpKey: TOTP_KEY, clock });
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({
    pool,
    logStream: captureLogs().stream,
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

async function staff(role: Role, isDemo = false): Promise<string> {
  const created = await creator.execute({ email: uniqueEmail(), name: 'Lia', role, isDemo });
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
  return response.json<{ token: string }>().token;
}

interface Customer {
  id: string;
  email: string;
  cpf: string;
  accessToken: string;
  refreshToken: string;
}

async function customer(options: { demo?: boolean; protectedDemo?: boolean } = {}) {
  const email = uniqueEmail();
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Clara Teste', email, cpf, password: PASSWORD },
    remoteAddress: `198.18.10.${String(nextIp++ % 250)}`,
  });
  expect(response.statusCode, response.body).toBe(201);
  if (options.demo === true || options.protectedDemo === true) {
    await migrator.query(
      'UPDATE identity.users SET is_demo = true, demo_protected = $2 WHERE email = $1',
      [email, options.protectedDemo === true],
    );
  }
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM identity.users WHERE email = $1',
    [email],
  );
  const tokens = response.json<{ accessToken: string; refreshToken: string }>();
  const pin = await app.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin: PIN },
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  expect(pin.statusCode).toBe(204);
  return { id: rows[0]?.id ?? '', email, cpf, ...tokens } satisfies Customer;
}

const admin = (token: string, key = randomUUID()) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
  'idempotency-key': key,
});

const block = (token: string, customerId: string, key = randomUUID()) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/customers/${customerId}/block`,
    headers: admin(token, key),
    payload: { reason: 'FRAUD_SUSPECTED' },
  });

const requestUnblock = (token: string, customerId: string) =>
  app.inject({
    method: 'POST',
    url: '/admin/v1/requests',
    headers: admin(token),
    payload: {
      kind: 'UNBLOCK_ACCOUNT',
      customerId,
      reason: 'CUSTOMER_REQUEST',
      note: 'Cliente confirmou a identidade por telefone',
    },
  });

const decide = (token: string, requestId: string, verb: 'approve' | 'reject' | 'cancel') =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/requests/${requestId}/${verb}`,
    headers: admin(token),
    payload: {},
  });

const refresh = (refreshToken: string) =>
  app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken } });

const login = (email: string) =>
  app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: PASSWORD },
    remoteAddress: `198.18.11.${String(nextIp++ % 250)}`,
  });

const createPix = (payer: Customer, payee: Customer) =>
  app.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    headers: { authorization: `Bearer ${payer.accessToken}`, 'idempotency-key': randomUUID() },
    payload: { key: { type: 'CPF', value: payee.cpf }, amount: { amount: 1_000, currency: 'BRL' } },
  });

/** Events about a customer's account: the account is the subject, the customer in the metadata. */
async function countOf(action: string, customerId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit.audit_events
     WHERE action = $1 AND metadata->>'customerId' = $2`,
    [action, customerId],
  );
  return rows[0]?.n ?? 0;
}

// F-12, "Pronto quando" (1): attack first.
describe('POST /admin/v1/customers/{id}/block', () => {
  it('shuts the customer out at once: no refresh, no login, no Pix', async () => {
    const operator = await staff('OPERATOR');
    const target = await customer();
    const payee = await customer();

    const response = await block(operator, target.id);

    expect(response.statusCode, response.body).toBe(204);
    expect((await refresh(target.refreshToken)).statusCode).toBe(401);
    expect((await login(target.email)).statusCode).toBe(401);
    // The access token still verifies for up to 15 minutes (ADR 0004), but
    // money asks the database whether the session lives (AUTH-04).
    expect((await createPix(target, payee)).statusCode).toBe(401);
    const { rows } = await pool.query<{ status: string }>(
      `SELECT a.status FROM accounts.accounts a WHERE a.holder_user_id = $1`,
      [target.id],
    );
    expect(rows[0]?.status).toBe('BLOCKED');
  });

  it('revokes every session with the reason, audited', async () => {
    const operator = await staff('OPERATOR');
    const target = await customer();
    await login(target.email);

    await block(operator, target.id);

    const { rows } = await pool.query<{ live: number; blocked: number }>(
      `SELECT count(*) FILTER (WHERE revoked_at IS NULL)::int AS live,
              count(*) FILTER (WHERE revoked_reason = 'ACCOUNT_BLOCKED')::int AS blocked
       FROM identity.sessions WHERE user_id = $1`,
      [target.id],
    );
    expect(rows[0]).toEqual({ live: 0, blocked: 2 });
    expect(await countOf('ACCOUNT_BLOCKED', target.id)).toBe(1);
  });

  it('answers 409 to a second block, and repeats the first answer for the same key', async () => {
    const operator = await staff('ANALYST');
    const target = await customer();
    const key = randomUUID();
    await block(operator, target.id, key);

    expect((await block(operator, target.id, key)).statusCode).toBe(204);
    const again = await block(operator, target.id);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('AccountAlreadyBlocked');
  });

  it('either lets a Pix in flight finish first, or refuses it: never half of each', async () => {
    const operator = await staff('OPERATOR');
    const payer = await customer();
    const payee = await customer();
    const created = await createPix(payer, payee);
    const pixId = created.json<{ id: string }>().id;

    const [authorized] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/pix/transfers/${pixId}/authorize`,
        headers: { authorization: `Bearer ${payer.accessToken}`, 'idempotency-key': randomUUID() },
        payload: { pin: PIN },
      }),
      block(operator, payer.id),
    ]);

    const { rows } = await pool.query<{ status: string; entries: number }>(
      `SELECT t.status,
              (SELECT count(*)::int FROM ledger.journal_entries
               WHERE reference_type = 'PIX_TRANSFER' AND reference_id = t.id) AS entries
       FROM payments.pix_transfers t WHERE t.id = $1`,
      [pixId],
    );
    const outcome = rows[0];
    if (outcome?.status === 'COMPLETED') {
      expect(outcome.entries).toBe(1);
    } else {
      expect(outcome?.entries).toBe(0);
      expect([200, 401]).toContain(authorized.statusCode);
    }
  });
});

describe('the unblock request', () => {
  async function blockedWithRequest() {
    const operator = await staff('OPERATOR');
    const target = await customer();
    await block(operator, target.id);
    const opened = await requestUnblock(operator, target.id);
    expect(opened.statusCode, opened.body).toBe(201);
    return { operator, target, requestId: opened.json<{ id: string }>().id };
  }

  it('approved by an analyst, unblocks the account and lets the customer back in', async () => {
    const { target, requestId } = await blockedWithRequest();
    const analyst = await staff('ANALYST');

    const approved = await decide(analyst, requestId, 'approve');

    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'APPROVED' });
    expect((await login(target.email)).statusCode).toBe(200);
    expect(await countOf('ACCOUNT_UNBLOCKED', target.id)).toBe(1);
  });

  // "Pronto quando" (2): never by the API either.
  it('never lets the requester approve it, by any role (STF-03)', async () => {
    const { operator, requestId } = await blockedWithRequest();

    // The operator holds no requests.decide: refused before reaching the domain.
    expect((await decide(operator, requestId, 'approve')).statusCode).toBe(403);
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM operations.decisions WHERE request_id = $1',
      [requestId],
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('decides once when two analysts approve at the same time (STF-09)', async () => {
    const { target, requestId } = await blockedWithRequest();
    const [first, second] = await Promise.all([staff('ANALYST'), staff('ANALYST')]);

    const answers = await Promise.all([
      decide(first, requestId, 'approve'),
      decide(second, requestId, 'approve'),
    ]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 409]);
    expect(await countOf('ACCOUNT_UNBLOCKED', target.id)).toBe(1);
  });

  it('decides once when approved and cancelled at the same time', async () => {
    const { operator, requestId } = await blockedWithRequest();
    const analyst = await staff('ANALYST');

    const answers = await Promise.all([
      decide(analyst, requestId, 'approve'),
      decide(operator, requestId, 'cancel'),
    ]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 409]);
  });

  it('lets only the requester cancel', async () => {
    const { requestId } = await blockedWithRequest();
    const otherOperator = await staff('OPERATOR');

    const refused = await decide(otherOperator, requestId, 'cancel');

    expect(refused.statusCode).toBe(403);
    expect(refused.json<{ code: string }>().code).toBe('NotTheRequester');
  });

  it('refuses a second open request for the same account', async () => {
    const { operator, target } = await blockedWithRequest();

    const again = await requestUnblock(operator, target.id);

    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('RequestAlreadyOpen');
  });

  it('lists the pending requests and shows one with its people', async () => {
    const { requestId } = await blockedWithRequest();
    const analyst = await staff('ANALYST');

    const list = await app.inject({
      method: 'GET',
      url: '/admin/v1/requests?status=PENDING',
      headers: admin(analyst),
    });
    const detail = await app.inject({
      method: 'GET',
      url: `/admin/v1/requests/${requestId}`,
      headers: admin(analyst),
    });

    expect(list.statusCode, list.body).toBe(200);
    expect(list.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toContain(
      requestId,
    );
    expect(detail.json()).toMatchObject({
      id: requestId,
      kind: 'UNBLOCK_ACCOUNT',
      status: 'PENDING',
      reason: 'CUSTOMER_REQUEST',
      note: 'Cliente confirmou a identidade por telefone',
      requestedBy: { name: 'Lia' },
      decision: null,
    });
  });
});

// STF-02: each role reaches only its commands.
describe('who does what (K3)', () => {
  it('lets the analyst block, never open a request; the admin, neither', async () => {
    const analyst = await staff('ANALYST');
    const admin_ = await staff('ADMIN');
    const target = await customer();

    expect((await block(admin_, target.id)).statusCode).toBe(403);
    expect((await block(analyst, target.id)).statusCode).toBe(204);
    expect((await requestUnblock(analyst, target.id)).statusCode).toBe(403);
    expect((await requestUnblock(admin_, target.id)).statusCode).toBe(403);
  });

  it('refuses a command without an Idempotency-Key', async () => {
    const operator = await staff('OPERATOR');
    const target = await customer();

    const response = await app.inject({
      method: 'POST',
      url: `/admin/v1/customers/${target.id}/block`,
      headers: { 'x-backoffice-key': BACKOFFICE_KEY, authorization: `Bearer ${operator}` },
      payload: { reason: 'FRAUD_SUSPECTED' },
    });

    expect(response.statusCode).toBe(422);
  });
});

// STF-11, STF-13 (K5): the demo staff's credentials are public.
describe('the demo staff', () => {
  it("never reaches a visitor's account", async () => {
    const demoOperator = await staff('OPERATOR', true);
    const visitor = await customer();

    expect((await block(demoOperator, visitor.id)).statusCode).toBe(404);
  });

  it('never blocks Ana or Bruno, and blocks the backoffice demo customer', async () => {
    const demoOperator = await staff('OPERATOR', true);
    const ana = await customer({ protectedDemo: true });
    const carla = await customer({ demo: true });

    const refused = await block(demoOperator, ana.id);

    expect(refused.statusCode).toBe(403);
    expect(refused.json<{ code: string }>().code).toBe('DemoCustomerProtected');
    expect((await refresh(ana.refreshToken)).statusCode).toBe(200);
    expect((await block(demoOperator, carla.id)).statusCode).toBe(204);
  });
});

// The backoffice's home (home plan, H1): the operator's own requests, decided
// by the session on the server. The filter only narrows a list the member
// may already read, and never lifts the demo scope (STF-11).
describe("the member's own requests", () => {
  async function openedBy(operator: string) {
    const target = await customer();
    await block(operator, target.id);
    const opened = await requestUnblock(operator, target.id);
    expect(opened.statusCode, opened.body).toBe(201);
    return opened.json<{ id: string }>().id;
  }

  const idsOf = async (token: string, query: string) => {
    const response = await app.inject({
      method: 'GET',
      url: `/admin/v1/requests${query}`,
      headers: admin(token),
    });
    expect(response.statusCode, response.body).toBe(200);
    return response.json<{ items: { id: string }[] }>().items.map((item) => item.id);
  };

  it('lists only what the member asked, pending or all', async () => {
    const olivia = await staff('OPERATOR');
    const other = await staff('OPERATOR');
    const hers = await openedBy(olivia);
    const theirs = await openedBy(other);

    for (const status of ['PENDING', 'ALL']) {
      const mine = await idsOf(olivia, `?status=${status}&mine=true`);
      expect(mine).toContain(hers);
      expect(mine).not.toContain(theirs);
    }
  });

  it('lists everyone’s requests without the filter, as before', async () => {
    const olivia = await staff('OPERATOR');
    const other = await staff('OPERATOR');
    const hers = await openedBy(olivia);
    const theirs = await openedBy(other);

    for (const query of ['', '?mine=false']) {
      const all = await idsOf(olivia, query);
      expect(all).toEqual(expect.arrayContaining([hers, theirs]));
    }
  });

  it('finds nothing for a member who asked nothing', async () => {
    const analyst = await staff('ANALYST');
    await openedBy(await staff('OPERATOR'));

    expect(await idsOf(analyst, '?status=ALL&mine=true')).toEqual([]);
  });

  it('refuses a filter that is not true or false', async () => {
    const operator = await staff('OPERATOR');

    const response = await app.inject({
      method: 'GET',
      url: '/admin/v1/requests?mine=maybe',
      headers: admin(operator),
    });

    expect(response.statusCode).toBe(422);
  });

  it('keeps the demo staff to the demo customers (STF-11)', async () => {
    const demoOperator = await staff('OPERATOR', true);
    const target = await customer({ demo: true });
    await block(demoOperator, target.id);
    const opened = await requestUnblock(demoOperator, target.id);
    expect(opened.statusCode, opened.body).toBe(201);
    const outside = await openedBy(await staff('OPERATOR'));

    const mine = await idsOf(demoOperator, '?status=ALL&mine=true');

    expect(mine).toContain(opened.json<{ id: string }>().id);
    expect(mine).not.toContain(outside);
  });
});
