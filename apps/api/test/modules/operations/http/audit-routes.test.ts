import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { staffCreator } from '../../../../scripts/create-staff.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { participantKey, type RunningSimulator, startSimulator } from '../../../simulator.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { uniqueEmail } from '../../identity/fixtures.ts';
import { externalPixClient } from '../../payments/http/external-pix-client.ts';

// The audit trail read by the staff (v1.3.0 plan, task 8), against the real
// Postgres and simulator: by customer, by member or by request, always one
// filter (STF-16), each in the reader's scope (STF-11). The divergent Pix of
// task 6, resolved with two people, reads right in its request's trail
// ("Pronto quando"); a customer's trail is itself recorded (STF-07).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const pool = createPool(testDatabaseUrl());
const clock = new FixedClock(new Date());
const creator = staffCreator({ pool, totpKey: TOTP_KEY, clock });
let simulator: RunningSimulator;
let app: FastifyInstance;
let client: ReturnType<typeof externalPixClient>;

beforeAll(async () => {
  simulator = await startSimulator();
  app = buildApp({
    pool,
    logStream: captureLogs().stream,
    security: testSecurity(),
    backoffice: { apiKey: BACKOFFICE_KEY, totpKey: TOTP_KEY },
    externalPix: {
      simulatorUrl: simulator.url,
      participantKey,
      webhookSecret: randomBytes(32),
    },
    clock,
  });
  client = externalPixClient(app, '198.18.16');
});
afterAll(async () => {
  await app.close();
  await simulator.close();
});

interface Member {
  id: string;
  token: string;
}

async function staff(role: 'OPERATOR' | 'ANALYST' | 'ADMIN', isDemo = false): Promise<Member> {
  const created = await creator.execute({ email: uniqueEmail(), name: 'Lia', role, isDemo });
  // A step of its own for each sign-in: a code works once.
  clock.current = new Date(clock.now().getTime() + 30_000);
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
  return { id: created.id, token: response.json<{ token: string }>().token };
}

const admin = (token: string) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
  'idempotency-key': randomUUID(),
});

const trail = (token: string, query: string) =>
  app.inject({ method: 'GET', url: `/admin/v1/audit?${query}`, headers: admin(token) });

interface Entry {
  action: string;
  actor: { type: string; id: string | null; name: string | null };
  subject: { type: string; id: string };
}

const actionsOf = (body: string) =>
  (JSON.parse(body) as { items: Entry[] }).items.map((item) => item.action);

/** A customer whose Pix to Banco Aurora waits for the SPI, and its exception. */
async function stuck() {
  const accessToken = await client.newCustomer();
  const pix = await client.sendToAurora(accessToken, 8_000);
  const exceptionId = randomUUID();
  await pool.query(
    `INSERT INTO reconciliation.exceptions
       (id, run_date, kind, end_to_end_id, expected_cents, actual_cents, detected_at)
     VALUES ($1, '2098-01-01', 'STALE_PROCESSING', $2, NULL, NULL, now())`,
    [exceptionId, pix.endToEndId],
  );
  const { rows } = await pool.query<{ id: string }>(
    `SELECT u.id FROM identity.users u
     JOIN accounts.accounts a ON a.holder_user_id = u.id
     JOIN payments.pix_transfers t ON t.payer_account_id = a.id
     WHERE t.id = $1`,
    [pix.id],
  );
  return { customerId: rows[0]?.id ?? '', pix, exceptionId };
}

describe('the audit trail', () => {
  it('reads the divergent Pix resolved with two people in its request\'s trail ("Pronto quando")', async () => {
    const { exceptionId } = await stuck();
    const operator = await staff('OPERATOR');
    const analyst = await staff('ANALYST');
    const asked = await app.inject({
      method: 'POST',
      url: '/admin/v1/requests',
      headers: admin(operator.token),
      payload: { kind: 'RESOLVE_EXCEPTION', exceptionId, resolution: 'REFUND', reason: 'OTHER' },
    });
    const requestId = asked.json<{ id: string }>().id;
    const approved = await app.inject({
      method: 'POST',
      url: `/admin/v1/requests/${requestId}/approve`,
      headers: admin(analyst.token),
      payload: {},
    });
    expect(approved.statusCode, approved.body).toBe(200);

    const response = await trail(analyst.token, `requestId=${requestId}`);

    expect(response.statusCode, response.body).toBe(200);
    expect(actionsOf(response.body)).toEqual(
      expect.arrayContaining([
        'REQUEST_CREATED',
        'PIX_FAILED',
        'EXCEPTION_RESOLVED',
        'REQUEST_APPROVED',
      ]),
    );
    const items = response.json<{ items: Entry[] }>().items;
    expect(items.find((item) => item.action === 'PIX_FAILED')?.actor).toEqual({
      type: 'STAFF',
      id: analyst.id,
      name: 'Lia',
    });
  });

  it("reads a customer's trail, and records that it was read (STF-07)", async () => {
    const { customerId } = await stuck();
    const analyst = await staff('ANALYST');

    const response = await trail(analyst.token, `customerId=${customerId}`);

    expect(response.statusCode, response.body).toBe(200);
    expect(actionsOf(response.body)).toEqual(
      expect.arrayContaining(['USER_REGISTERED', 'ACCOUNT_OPENED']),
    );
    const { rows } = await pool.query<{ metadata: { view: string } }>(
      `SELECT metadata FROM audit.audit_events
       WHERE action = 'SENSITIVE_DATA_ACCESSED' AND actor_id = $1 AND subject_id = $2`,
      [analyst.id, customerId],
    );
    expect(rows).toEqual([{ metadata: { view: 'AUDIT' } }]);
  });

  it("reads a member's trail, a page at a time, never skipping nor repeating", async () => {
    const operator = await staff('OPERATOR');
    const analyst = await staff('ANALYST');
    for (let i = 0; i < 21; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/admin/v1/customers/search',
        headers: admin(operator.token),
        payload: { query: `Nome${String(i)}` },
      });
    }

    const first = await trail(analyst.token, `memberId=${operator.id}`);
    const { items, nextCursor } = first.json<{ items: { id: string }[]; nextCursor: string }>();
    const second = await trail(analyst.token, `memberId=${operator.id}&cursor=${nextCursor}`);

    expect(items).toHaveLength(20);
    const rest = second.json<{ items: { id: string }[] }>().items;
    expect(rest.length).toBeGreaterThan(0);
    expect(new Set([...items, ...rest].map((item) => item.id)).size).toBe(
      items.length + rest.length,
    );
  });

  it('takes exactly one filter (STF-16)', async () => {
    const analyst = await staff('ANALYST');

    expect((await trail(analyst.token, '')).statusCode).toBe(422);
    expect(
      (await trail(analyst.token, `memberId=${randomUUID()}&requestId=${randomUUID()}`)).statusCode,
    ).toBe(422);
    expect(
      (await trail(analyst.token, 'cursor=bm90LWEtY3Vyc29y&memberId=' + analyst.id)).statusCode,
    ).toBe(422);
  });

  it('lets the admin read members and requests, never a customer, and keeps the operator out (H1, C1)', async () => {
    const { customerId } = await stuck();
    const boss = await staff('ADMIN');
    const operator = await staff('OPERATOR');

    expect((await trail(boss.token, `memberId=${operator.id}`)).statusCode).toBe(200);
    expect((await trail(boss.token, `customerId=${customerId}`)).statusCode).toBe(403);
    expect((await trail(operator.token, `memberId=${operator.id}`)).statusCode).toBe(403);
  });

  it("keeps the demo staff out of a visitor's, a real member's and a real request's trail (STF-11)", async () => {
    const { customerId } = await stuck();
    const demo = await staff('ANALYST', true);
    const real = await staff('OPERATOR');

    expect((await trail(demo.token, `customerId=${customerId}`)).statusCode).toBe(404);
    expect((await trail(demo.token, `memberId=${real.id}`)).statusCode).toBe(404);
    expect((await trail(demo.token, `requestId=${randomUUID()}`)).statusCode).toBe(404);
  });
});
