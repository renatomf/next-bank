import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { staffCreator } from '../../../../scripts/create-staff.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// Reversing a Pix with two people (v1.3.0 plan, task 5), against the real
// Postgres: the approval posts a new PIX_REVERSAL entry, once (STF-09), for
// the Pix's own amount (PIX-14), never below zero (B7), shown in both
// statements and in the audit trail ("Pronto quando", item 1).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const PASSWORD = 'violet staple orbit 42';
const PIN = '2580';
const START = 1_000_000;
const pool = createPool(testDatabaseUrl());
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
});

async function staff(role: 'OPERATOR' | 'ANALYST'): Promise<string> {
  const created = await creator.execute({ email: uniqueEmail(), name: 'Lia', role, isDemo: false });
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
  cpf: string;
  accessToken: string;
}

async function customer(): Promise<Customer> {
  const email = uniqueEmail();
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Clara Teste', email, cpf, password: PASSWORD },
    remoteAddress: `198.18.12.${String(nextIp++ % 250)}`,
  });
  expect(response.statusCode, response.body).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  await app.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin: PIN },
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM identity.users WHERE email = $1',
    [email],
  );
  return { id: rows[0]?.id ?? '', cpf, accessToken };
}

/** A Pix created and authorized: the answer of the authorization. */
async function pix(from: Customer, to: Customer, amount: number) {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/pix/transfers',
    headers: { authorization: `Bearer ${from.accessToken}`, 'idempotency-key': randomUUID() },
    payload: { key: { type: 'CPF', value: to.cpf }, amount: { amount, currency: 'BRL' } },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json<{ id: string }>().id;
  const authorized = await app.inject({
    method: 'POST',
    url: `/v1/pix/transfers/${id}/authorize`,
    headers: { authorization: `Bearer ${from.accessToken}`, 'idempotency-key': randomUUID() },
    payload: { pin: PIN },
  });
  return { id, status: authorized.json<{ status: string }>().status };
}

const admin = (token: string) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
  'idempotency-key': randomUUID(),
});

const askReversal = (token: string, transferId: string) =>
  app.inject({
    method: 'POST',
    url: '/admin/v1/requests',
    headers: admin(token),
    payload: { kind: 'REVERSE_PIX', transferId, reason: 'FRAUD_SUSPECTED' },
  });

const approve = (token: string, requestId: string) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/requests/${requestId}/approve`,
    headers: admin(token),
    payload: {},
  });

async function balanceOf(customerToken: string): Promise<number> {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/me/account',
    headers: { authorization: `Bearer ${customerToken}` },
  });
  return response.json<{ availableBalance: { amount: number } }>().availableBalance.amount;
}

async function reversalsOf(transferId: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ledger.journal_entries
     WHERE kind = 'PIX_REVERSAL' AND reference_id = $1`,
    [transferId],
  );
  return rows[0]?.n ?? 0;
}

async function opened(transferId: string) {
  const operator = await staff('OPERATOR');
  const asked = await askReversal(operator, transferId);
  expect(asked.statusCode, asked.body).toBe(201);
  return { operator, requestId: asked.json<{ id: string }>().id };
}

describe('the Pix reversal', () => {
  it('gives the amount back to the payer once approved, in both statements', async () => {
    const payer = await customer();
    const payee = await customer();
    const sent = await pix(payer, payee, 8_000);
    const { requestId } = await opened(sent.id);

    const approved = await approve(await staff('ANALYST'), requestId);

    expect(approved.statusCode, approved.body).toBe(200);
    expect(await balanceOf(payer.accessToken)).toBe(START);
    expect(await balanceOf(payee.accessToken)).toBe(START);
    for (const [who, direction] of [
      [payer, 'IN'],
      [payee, 'OUT'],
    ] as const) {
      const statement = await app.inject({
        method: 'GET',
        url: '/v1/me/statement',
        headers: { authorization: `Bearer ${who.accessToken}` },
      });
      expect(
        statement.json<{ items: { kind: string; direction: string }[] }>().items[0],
      ).toMatchObject({ kind: 'PIX_REVERSED', direction });
    }
    const { rows } = await pool.query<{ actor_type: string }>(
      "SELECT actor_type FROM audit.audit_events WHERE action = 'PIX_REVERSED' AND subject_id = $1",
      [sent.id],
    );
    expect(rows).toEqual([{ actor_type: 'STAFF' }]);
  });

  it('keeps the request pending when the payee no longer has the money (B7, V1)', async () => {
    const payer = await customer();
    const payee = await customer();
    const elsewhere = await customer();
    const sent = await pix(payer, payee, 8_000);
    await pix(payee, elsewhere, START + 5_000);
    const { requestId } = await opened(sent.id);

    const refused = await approve(await staff('ANALYST'), requestId);

    expect(refused.statusCode).toBe(409);
    expect(refused.json<{ code: string }>().code).toBe('PayeeInsufficientFunds');
    expect(await reversalsOf(sent.id)).toBe(0);
    expect(await balanceOf(payee.accessToken)).toBe(3_000);
  });

  it('reverses once when two analysts approve at the same time (STF-09)', async () => {
    const payer = await customer();
    const payee = await customer();
    const sent = await pix(payer, payee, 8_000);
    const { requestId } = await opened(sent.id);
    const [first, second] = await Promise.all([staff('ANALYST'), staff('ANALYST')]);

    const answers = await Promise.all([approve(first, requestId), approve(second, requestId)]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 409]);
    expect(await reversalsOf(sent.id)).toBe(1);
  });

  it('never takes the payee below zero, racing a Pix of the payee', async () => {
    const payer = await customer();
    const payee = await customer();
    const elsewhere = await customer();
    const sent = await pix(payer, payee, 8_000);
    const { requestId } = await opened(sent.id);
    const analyst = await staff('ANALYST');

    // The payee holds START + 8,000: the reversal and this Pix cannot both pass.
    const [approved, spent] = await Promise.all([
      approve(analyst, requestId),
      pix(payee, elsewhere, START),
    ]);

    const balance = await balanceOf(payee.accessToken);
    expect(balance).toBeGreaterThanOrEqual(0);
    if (approved.statusCode === 200) {
      expect(spent.status).toBe('FAILED');
      expect(balance).toBe(START);
    } else {
      expect(approved.json<{ code: string }>().code).toBe('PayeeInsufficientFunds');
      expect(spent.status).toBe('COMPLETED');
      expect(balance).toBe(8_000);
    }
  });

  it('refuses a Pix already reversed, and a second open request (PIX-14)', async () => {
    const payer = await customer();
    const payee = await customer();
    const sent = await pix(payer, payee, 8_000);
    const { operator, requestId } = await opened(sent.id);

    const again = await askReversal(operator, sent.id);
    expect(again.json<{ code: string }>().code).toBe('RequestAlreadyOpen');
    await approve(await staff('ANALYST'), requestId);

    const after = await askReversal(operator, sent.id);
    expect(after.statusCode).toBe(409);
    expect(after.json<{ code: string }>().code).toBe('PixNotReversible');
  });

  it('takes no amount from the request: the Pix decides it (PIX-14)', async () => {
    const payer = await customer();
    const payee = await customer();
    const sent = await pix(payer, payee, 8_000);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/v1/requests',
      headers: admin(await staff('OPERATOR')),
      payload: {
        kind: 'REVERSE_PIX',
        transferId: sent.id,
        reason: 'OTHER',
        amount: { amount: 999_999, currency: 'BRL' },
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('lets only the analyst approve (STF-02)', async () => {
    const payer = await customer();
    const payee = await customer();
    const sent = await pix(payer, payee, 8_000);
    const { operator, requestId } = await opened(sent.id);

    expect((await approve(operator, requestId)).statusCode).toBe(403);
    expect(await reversalsOf(sent.id)).toBe(0);
  });
});
