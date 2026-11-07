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

// The member's own requests, against the real Postgres (backoffice home
// plan, H1). In a file of its own, so that its requests have a rate limit
// of their own too.
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
