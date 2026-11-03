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
import { externalPixClient, signedWebhook } from '../../payments/http/external-pix-client.ts';

// The reconciliation's exceptions resolved by the staff (v1.3.0 plan, task 6),
// against the real Postgres and the real simulator. A Pix to another bank
// left waiting for the SPI is refunded or settled by an operator's request
// and an analyst's approval, through the SPI's own path, and shows right in
// the customer's statement and the audit trail ("Pronto quando", item 1). The
// SPI's late answer racing the approval ends the Pix once (REC-01). The
// exceptions are recorded here as the daily reconciliation would.
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const WEBHOOK_SECRET = randomBytes(32);
const START = 1_000_000;
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
    externalPix: { simulatorUrl: simulator.url, participantKey, webhookSecret: WEBHOOK_SECRET },
    clock,
  });
  client = externalPixClient(app, '198.18.14');
});
afterAll(async () => {
  await app.close();
  await simulator.close();
});

async function staff(role: 'OPERATOR' | 'ANALYST', isDemo = false): Promise<string> {
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

const admin = (token: string) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
  'idempotency-key': randomUUID(),
});

let minutes = 0;
/** Records an exception as the daily reconciliation would, the newest so far. */
async function found(kind: string, endToEndId: string | null): Promise<string> {
  const id = randomUUID();
  // Far ahead of any other test's exceptions, so this file's lead the queue.
  const detectedAt = new Date(Date.UTC(2099, 0, 1, 0, ++minutes));
  await pool.query(
    `INSERT INTO reconciliation.exceptions
       (id, run_date, kind, end_to_end_id, expected_cents, actual_cents, detected_at)
     VALUES ($1, '2099-01-01', $2, $3, NULL, NULL, $4)`,
    [id, kind, endToEndId, detectedAt],
  );
  return id;
}

/** A customer whose Pix to Banco Aurora waits for the SPI, and its exception. */
async function stuck(kind = 'STALE_PROCESSING') {
  const accessToken = await client.newCustomer();
  const pix = await client.sendToAurora(accessToken, 8_000);
  return { accessToken, pix, exceptionId: await found(kind, pix.endToEndId) };
}

const askToResolve = (token: string, exceptionId: string, resolution: 'SETTLE' | 'REFUND') =>
  app.inject({
    method: 'POST',
    url: '/admin/v1/requests',
    headers: admin(token),
    payload: { kind: 'RESOLVE_EXCEPTION', exceptionId, resolution, reason: 'OTHER' },
  });

const approve = (token: string, requestId: string) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/requests/${requestId}/approve`,
    headers: admin(token),
    payload: {},
  });

const explain = (
  token: string,
  exceptionId: string,
  explanation = 'Conferido no SPI: devolvido.',
) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/exceptions/${exceptionId}/explain`,
    headers: admin(token),
    payload: { explanation },
  });

const read = (token: string, exceptionId: string) =>
  app.inject({
    method: 'GET',
    url: `/admin/v1/exceptions/${exceptionId}`,
    headers: admin(token),
  });

async function opened(exceptionId: string, resolution: 'SETTLE' | 'REFUND') {
  const asked = await askToResolve(await staff('OPERATOR'), exceptionId, resolution);
  expect(asked.statusCode, asked.body).toBe(201);
  return asked.json<{ id: string }>().id;
}

/** How many times the ledger ended this Pix: settled or refunded. */
async function endingsOf(transferId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ledger.journal_entries
     WHERE reference_id = $1 AND kind IN ('PIX_EXTERNAL_SETTLEMENT', 'PIX_EXTERNAL_REFUND')`,
    [transferId],
  );
  return rows[0]?.n ?? 0;
}

describe('resolving a Pix left waiting for the SPI', () => {
  it('refunds it with two people, right in the statement and the audit trail', async () => {
    const { accessToken, pix, exceptionId } = await stuck();
    const operator = await staff('OPERATOR');
    expect((await read(operator, exceptionId)).json()).toMatchObject({
      status: 'OPEN',
      kind: 'STALE_PROCESSING',
      pix: { id: pix.id, status: 'PROCESSING', amount: { amount: 8_000, currency: 'BRL' } },
      pendingRequestId: null,
    });
    const asked = await askToResolve(operator, exceptionId, 'REFUND');
    expect(asked.statusCode, asked.body).toBe(201);
    const requestId = asked.json<{ id: string }>().id;

    const approved = await approve(await staff('ANALYST'), requestId);

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await client.balanceOf(accessToken)).toBe(START);
    expect(await client.pix(accessToken, pix.id)).toMatchObject({ status: 'FAILED' });
    const statement = await app.inject({
      method: 'GET',
      url: '/v1/me/statement',
      headers: client.auth(accessToken),
    });
    expect(statement.json<{ items: { kind: string }[] }>().items[0]).toMatchObject({
      kind: 'PIX_REFUNDED',
    });
    expect((await read(operator, exceptionId)).json()).toMatchObject({
      status: 'RESOLVED',
      resolution: { outcome: 'REFUNDED', approvalRequestId: requestId, explanation: null },
    });
    const { rows } = await pool.query<{ action: string; actor_type: string }>(
      `SELECT action, actor_type FROM audit.audit_events
       WHERE subject_id = ANY($1::uuid[]) ORDER BY occurred_at, action`,
      [[pix.id, exceptionId, requestId]],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { action: 'PIX_FAILED', actor_type: 'STAFF' },
        { action: 'EXCEPTION_RESOLVED', actor_type: 'STAFF' },
        { action: 'REQUEST_CREATED', actor_type: 'STAFF' },
        { action: 'REQUEST_APPROVED', actor_type: 'STAFF' },
      ]),
    );
  });

  it('settles it: the Pix completes and the money stays with the other bank', async () => {
    const { accessToken, pix, exceptionId } = await stuck();
    const requestId = await opened(exceptionId, 'SETTLE');

    const approved = await approve(await staff('ANALYST'), requestId);

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await client.pix(accessToken, pix.id)).toMatchObject({ status: 'COMPLETED' });
    expect(await client.balanceOf(accessToken)).toBe(START - 8_000);
  });

  it("ends the Pix once when the SPI's late answer races the approval (REC-01)", async () => {
    const { accessToken, pix, exceptionId } = await stuck();
    const requestId = await opened(exceptionId, 'REFUND');
    const analyst = await staff('ANALYST');
    const webhook = signedWebhook(
      WEBHOOK_SECRET,
      {
        eventId: randomUUID(),
        version: 1,
        endToEndId: pix.endToEndId,
        status: 'SETTLED',
        occurredAt: clock.now().toISOString(),
      },
      Math.floor(clock.now().getTime() / 1000),
    );

    const [approved, answered] = await Promise.all([
      approve(analyst, requestId),
      app.inject({
        method: 'POST',
        url: '/v1/spi/webhooks',
        headers: webhook.headers,
        payload: webhook.body,
      }),
    ]);

    expect(answered.statusCode).toBe(200);
    expect(await endingsOf(pix.id)).toBe(1);
    if (approved.statusCode === 200) {
      expect(await client.pix(accessToken, pix.id)).toMatchObject({ status: 'FAILED' });
    } else {
      expect(approved.json<{ code: string }>().code).toBe('PixNoLongerProcessing');
      expect(await client.pix(accessToken, pix.id)).toMatchObject({ status: 'COMPLETED' });
      expect((await read(analyst, exceptionId)).json()).toMatchObject({
        status: 'OPEN',
        pendingRequestId: requestId,
      });
    }
  });

  it('ends it once when two analysts approve at the same time (STF-09)', async () => {
    const { pix, exceptionId } = await stuck();
    const requestId = await opened(exceptionId, 'REFUND');
    const [first, second] = await Promise.all([staff('ANALYST'), staff('ANALYST')]);

    const answers = await Promise.all([approve(first, requestId), approve(second, requestId)]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 409]);
    expect(await endingsOf(pix.id)).toBe(1);
  });

  it('takes one request per exception, and only from an operator (STF-02)', async () => {
    const { exceptionId } = await stuck();
    const analyst = await staff('ANALYST');
    expect((await askToResolve(analyst, exceptionId, 'REFUND')).statusCode).toBe(403);
    await opened(exceptionId, 'REFUND');

    const again = await askToResolve(await staff('OPERATOR'), exceptionId, 'SETTLE');

    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('ExceptionNotOpen');
  });
});

describe('explaining an exception', () => {
  it('settles nothing but a Pix left waiting; an analyst explains the rest (X1, X2)', async () => {
    const { exceptionId } = await stuck('MISSING_AT_SPI');
    const operator = await staff('OPERATOR');
    const analyst = await staff('ANALYST');

    const refused = await askToResolve(operator, exceptionId, 'SETTLE');
    expect(refused.statusCode).toBe(409);
    expect(refused.json<{ code: string }>().code).toBe('ExceptionNotSettleable');
    expect((await explain(operator, exceptionId)).statusCode).toBe(403);
    expect((await explain(analyst, exceptionId, 'curto')).statusCode).toBe(422);

    const explained = await explain(analyst, exceptionId);

    expect(explained.statusCode, explained.body).toBe(200);
    expect(explained.json()).toMatchObject({
      status: 'RESOLVED',
      resolution: { outcome: 'EXPLAINED', explanation: 'Conferido no SPI: devolvido.' },
    });
    const again = await explain(analyst, exceptionId);
    expect(again.json<{ code: string }>().code).toBe('ExceptionNotOpen');
    const { rows } = await pool.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit.audit_events
       WHERE action = 'EXCEPTION_RESOLVED' AND subject_id = $1`,
      [exceptionId],
    );
    expect(rows).toEqual([{ metadata: { kind: 'MISSING_AT_SPI', outcome: 'EXPLAINED' } }]);
  });

  it('resolves one way when explaining and asking race each other', async () => {
    const { exceptionId } = await stuck();
    const [operator, analyst] = await Promise.all([staff('OPERATOR'), staff('ANALYST')]);

    const [explained, asked] = await Promise.all([
      explain(analyst, exceptionId),
      askToResolve(operator, exceptionId, 'REFUND'),
    ]);

    const succeeded = [explained.statusCode === 200, asked.statusCode === 201];
    expect(succeeded.filter(Boolean)).toHaveLength(1);
    const loser = explained.statusCode === 200 ? asked : explained;
    expect(loser.json<{ code: string }>().code).toBe('ExceptionNotOpen');
  });
});

describe('the exceptions queue', () => {
  it('lists the open ones newest first, and the resolved ones when asked for all', async () => {
    const older = await found('CLEARING_MISMATCH', null);
    const newer = (await stuck()).exceptionId;
    const operator = await staff('OPERATOR');
    await explain(await staff('ANALYST'), older);

    const open = await app.inject({
      method: 'GET',
      url: '/admin/v1/exceptions',
      headers: admin(operator),
    });
    const all = await app.inject({
      method: 'GET',
      url: '/admin/v1/exceptions?status=ALL',
      headers: admin(operator),
    });

    expect(open.statusCode, open.body).toBe(200);
    const openIds = open.json<{ items: { id: string }[] }>().items.map((item) => item.id);
    expect(openIds[0]).toBe(newer);
    expect(openIds).not.toContain(older);
    const allIds = all.json<{ items: { id: string }[] }>().items.map((item) => item.id);
    expect(allIds.slice(0, 2)).toEqual([newer, older]);
  });

  it("never shows the demo staff a visitor's Pix (X5, STF-11)", async () => {
    const { exceptionId } = await stuck();
    const demo = await staff('OPERATOR', true);

    expect((await read(demo, exceptionId)).statusCode).toBe(404);
    const page = await app.inject({
      method: 'GET',
      url: '/admin/v1/exceptions?status=ALL',
      headers: admin(demo),
    });
    expect(page.statusCode).toBe(200);
    expect(page.json<{ items: { id: string }[] }>().items.map((item) => item.id)).not.toContain(
      exceptionId,
    );
    expect((await askToResolve(demo, exceptionId, 'REFUND')).statusCode).toBe(404);
  });

  it('refuses a malformed cursor', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/v1/exceptions?cursor=bm90LWEtY3Vyc29y',
      headers: admin(await staff('OPERATOR')),
    });

    expect(response.statusCode).toBe(422);
  });
});
