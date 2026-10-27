import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { saoPauloDate } from '../../../../src/modules/payments/domain/pix-schedule.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// The scheduled Pix over HTTP against the real database (v1.2.0 plan, task
// 7): POST /v1/pix/schedules with the PIN and an Idempotency-Key, the list,
// the detail and the cancel; every route has its IDOR test (READ-01, EXT-06).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const PIN = '2580';
const DAY_MS = 24 * 60 * 60 * 1000;
let app: FastifyInstance;
let nextIp = 1;

beforeAll(() => {
  app = buildApp({ pool, logStream: captureLogs().stream, security });
});

afterAll(async () => {
  await app.close();
});

const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });
/** A day of São Paulo [days] from now. */
const inDays = (days: number) => saoPauloDate(new Date(Date.now() + days * DAY_MS));

async function newCustomer(pin: string | null = PIN) {
  const cpf = fictitiousCpf();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email: uniqueEmail(), cpf, password: 'violet staple orbit 42' },
    remoteAddress: `198.18.9.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { accessToken } = response.json<{ accessToken: string }>();
  if (pin !== null) {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/me/pin',
      payload: { pin },
      headers: auth(accessToken),
    });
    expect(created.statusCode).toBe(204);
  }
  return { accessToken, cpf };
}

function schedule(
  accessToken: string,
  payload: Record<string, unknown>,
  key: string = randomUUID(),
) {
  return app.inject({
    method: 'POST',
    url: '/v1/pix/schedules',
    headers: { ...auth(accessToken), 'idempotency-key': key },
    payload,
  });
}

const request = (payeeCpf: string, changes: Record<string, unknown> = {}) => ({
  key: { type: 'CPF', value: payeeCpf },
  amount: { amount: 15_000, currency: 'BRL' },
  description: 'Aluguel',
  firstDate: inDays(3),
  recurrence: { frequency: 'MONTHLY', times: 3 },
  pin: PIN,
  ...changes,
});

const detail = (accessToken: string, id: string) =>
  app.inject({ method: 'GET', url: `/v1/pix/schedules/${id}`, headers: auth(accessToken) });

const list = (accessToken: string, cursor?: string) =>
  app.inject({
    method: 'GET',
    url: `/v1/pix/schedules${cursor === undefined ? '' : `?cursor=${cursor}`}`,
    headers: auth(accessToken),
  });

const cancel = (accessToken: string, id: string) =>
  app.inject({ method: 'POST', url: `/v1/pix/schedules/${id}/cancel`, headers: auth(accessToken) });

/** A payer with a monthly Pix scheduled to a payee. */
async function scheduled() {
  const payer = await newCustomer();
  const payee = await newCustomer(null);
  const response = await schedule(payer.accessToken, request(payee.cpf));
  expect(response.statusCode).toBe(201);
  return { payer, payee, schedule: response.json<{ id: string }>() };
}

describe('POST /v1/pix/schedules', () => {
  it('schedules the Pix and answers what the payer may see', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer(null);
    const firstDate = inDays(3);

    const response = await schedule(payer.accessToken, request(payee.cpf, { firstDate }));

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String) as string,
      status: 'ACTIVE',
      amount: { amount: 15_000, currency: 'BRL' },
      description: 'Aluguel',
      payee: {
        name: 'Maria Teste',
        documentMasked: expect.stringMatching(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/) as string,
        keyType: 'CPF',
        keyMasked: expect.any(String) as string,
      },
      firstDate,
      recurrence: { frequency: 'MONTHLY', times: 3 },
      nextOccurrenceDate: firstDate,
      lastOccurrenceDate: expect.any(String) as string,
      createdAt: expect.any(String) as string,
      cancelledAt: null,
    });
  });

  it('answers a repeated request the same, scheduling once', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer(null);
    const key = randomUUID();

    const first = await schedule(payer.accessToken, request(payee.cpf), key);
    const second = await schedule(payer.accessToken, request(payee.cpf), key);

    expect(second.json()).toEqual(first.json());
    expect((await list(payer.accessToken)).json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  it('refuses a wrong PIN with the attempts left, and schedules nothing', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer(null);

    const response = await schedule(payer.accessToken, request(payee.cpf, { pin: '1111' }));

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 4 });
    expect((await list(payer.accessToken)).json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('asks for a PIN first when there is none', async () => {
    const payer = await newCustomer(null);
    const payee = await newCustomer(null);

    const response = await schedule(payer.accessToken, request(payee.cpf));

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('PinNotCreated');
  });

  it.each([
    ['today', { firstDate: inDays(0) }, 'ScheduleInPast'],
    ['over a year ahead', { firstDate: inDays(400) }, 'InvalidRecurrence'],
    ['25 times', { recurrence: { frequency: 'MONTHLY', times: 25 } }, 'InvalidRecurrence'],
    ['above the daytime limit', { amount: { amount: 500_001, currency: 'BRL' } }, 'LimitExceeded'],
  ])('refuses a schedule %s with its catalog error', async (_case, changes, code) => {
    const payer = await newCustomer();
    const payee = await newCustomer(null);

    const response = await schedule(payer.accessToken, request(payee.cpf, changes));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe(code);
  });

  // PIX-01, PIX-04: no payer in the body, nothing unknown, a well-formed date.
  it.each([
    ['an unknown field', { payerAccountId: randomUUID() }],
    ['a malformed date', { firstDate: '05/11/2026' }],
    ['a monthly Pix without times', { recurrence: { frequency: 'MONTHLY' } }],
    ['a frequency not offered', { recurrence: { frequency: 'WEEKLY', times: 2 } }],
    ['a PIN that is not 4 digits', { pin: '12345' }],
  ])('refuses %s as an invalid request', async (_case, changes) => {
    const payer = await newCustomer();

    const response = await schedule(payer.accessToken, request(fictitiousCpf(), changes));

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('requires an Idempotency-Key and a token', async () => {
    const payer = await newCustomer();

    const withoutKey = await app.inject({
      method: 'POST',
      url: '/v1/pix/schedules',
      headers: auth(payer.accessToken),
      payload: request(fictitiousCpf()),
    });
    const withoutToken = await app.inject({
      method: 'POST',
      url: '/v1/pix/schedules',
      headers: { 'idempotency-key': randomUUID() },
      payload: request(fictitiousCpf()),
    });

    expect(withoutKey.statusCode).toBe(422);
    expect(withoutToken.statusCode).toBe(401);
  });
});

describe('GET /v1/pix/schedules', () => {
  it("lists the payer's schedules and nobody else's", async () => {
    const { payer, payee, schedule: created } = await scheduled();

    const mine = await list(payer.accessToken);
    const theirs = await list(payee.accessToken);

    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toEqual({
      items: [(await detail(payer.accessToken, created.id)).json()].map(
        ({ occurrences: _, ...item }: { occurrences: unknown }) => item,
      ),
      nextCursor: null,
    });
    expect(theirs.json()).toEqual({ items: [], nextCursor: null });
  });

  it('pages by 20 with an opaque cursor, and refuses a forged one', async () => {
    const payer = await newCustomer();
    const payee = await newCustomer(null);
    for (let i = 0; i < 21; i += 1) {
      expect((await schedule(payer.accessToken, request(payee.cpf))).statusCode).toBe(201);
    }

    const first = (await list(payer.accessToken)).json<{ items: unknown[]; nextCursor: string }>();
    const second = (await list(payer.accessToken, first.nextCursor)).json<{
      items: unknown[];
      nextCursor: string | null;
    }>();
    const forged = await list(payer.accessToken, 'not-a-cursor');

    expect(first.items).toHaveLength(20);
    expect(second).toMatchObject({ nextCursor: null });
    expect(second.items).toHaveLength(1);
    expect(forged.statusCode).toBe(422);
    expect(forged.json<{ code: string }>().code).toBe('InvalidRequest');
  });
});

describe('GET /v1/pix/schedules/{scheduleId}', () => {
  it('shows the schedule with its occurrences, none yet', async () => {
    const { payer, schedule: created } = await scheduled();

    const response = await detail(payer.accessToken, created.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: created.id, occurrences: [] });
  });

  it("answers 404 to the payee and to a stranger, as for a schedule that doesn't exist", async () => {
    const { payee, schedule: created } = await scheduled();
    const stranger = await newCustomer(null);

    for (const response of [
      await detail(payee.accessToken, created.id),
      await detail(stranger.accessToken, created.id),
      await detail(stranger.accessToken, randomUUID()),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json<{ code: string }>().code).toBe('NotFound');
    }
  });
});

describe('POST /v1/pix/schedules/{scheduleId}/cancel', () => {
  it('cancels the schedule, and a repeated cancel answers the same (S6)', async () => {
    const { payer, schedule: created } = await scheduled();

    const first = await cancel(payer.accessToken, created.id);
    const second = await cancel(payer.accessToken, created.id);

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ status: 'CANCELLED', nextOccurrenceDate: null });
    expect(second.json()).toEqual(first.json());
  });

  it("cannot cancel another customer's schedule (EXT-06)", async () => {
    const { payer, payee, schedule: created } = await scheduled();

    const response = await cancel(payee.accessToken, created.id);

    expect(response.statusCode).toBe(404);
    expect((await detail(payer.accessToken, created.id)).json()).toMatchObject({
      status: 'ACTIVE',
    });
  });
});
