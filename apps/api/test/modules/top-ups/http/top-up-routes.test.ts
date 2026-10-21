import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import {
  SystemClock,
  UuidV7Generator,
} from '../../../../src/shared/infrastructure/system-ports.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// The top-up routes against the real database, the real Argon2id and the
// real ledger (v1.1.0 plan, task 5; TOP-01, TOP-02, READ-01, READ-02, PIX-05,
// PIX-09, MOB-02; database.md 7).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;
const PIN = '2580';
const PHONE = '(11) 90000-0001';

// Money moved straight through the ledger, to empty a balance without Pix limits.
const ledger = createLedgerModule({ clock: new SystemClock(), ids: new UuidV7Generator() });
const unitOfWork = new PgUnitOfWork(pool);

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});
afterAll(async () => {
  await app.close();
});

interface Customer {
  accessToken: string;
  accountId: string;
  ip: string;
}

const auth = (customer: Customer) => ({ authorization: `Bearer ${customer.accessToken}` });

async function newCustomer(): Promise<Customer> {
  const email = uniqueEmail();
  const ip = `198.18.7.${String(nextIp++)}`;
  const registered = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email,
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: ip,
  });
  expect(registered.statusCode).toBe(201);
  const { accessToken } = registered.json<{ accessToken: string }>();
  const pinCreated = await app.inject({
    method: 'POST',
    url: '/v1/me/pin',
    payload: { pin: PIN },
    headers: { authorization: `Bearer ${accessToken}` },
    remoteAddress: ip,
  });
  expect(pinCreated.statusCode).toBe(204);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT a.id FROM accounts.accounts a
     JOIN identity.users u ON u.id = a.holder_user_id WHERE u.email = $1`,
    [email],
  );
  return { accessToken, accountId: rows[0]?.id ?? '', ip };
}

function topUp(
  customer: Customer,
  payload: Record<string, unknown> = {},
  key: string = randomUUID(),
) {
  return app.inject({
    method: 'POST',
    url: '/v1/top-ups',
    headers: { ...auth(customer), 'idempotency-key': key },
    remoteAddress: customer.ip,
    payload: {
      operatorId: 'pulso-celular',
      phoneNumber: PHONE,
      amount: { amount: 3000, currency: 'BRL' },
      pin: PIN,
      ...payload,
    },
  });
}

async function availableCents(customer: Customer): Promise<number> {
  const response = await app.inject({
    method: 'GET',
    url: '/v1/me/account',
    headers: auth(customer),
    remoteAddress: customer.ip,
  });
  return response.json<{ availableBalance: { amount: number } }>().availableBalance.amount;
}

/** Leaves [cents] on the customer's balance, moving the rest to another customer. */
async function leaveOnly(customer: Customer, cents: number): Promise<void> {
  const other = await newCustomer();
  const move = (await availableCents(customer)) - cents;
  await unitOfWork.run((tx) =>
    ledger.customerAccounts.transferPix(tx, {
      transferId: randomUUID(),
      payerAccountId: customer.accountId,
      payeeAccountId: other.accountId,
      amount: Money.of(BigInt(move)),
      payer: { name: 'Maria Teste', documentMasked: '***.444.777-**' },
      payee: { name: 'Maria Teste', documentMasked: '***.456.789-**' },
    }),
  );
}

describe('GET /v1/top-ups/operators', () => {
  it('lists the three made-up operators and the fixed amounts (D6)', async () => {
    const customer = await newCustomer();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/top-ups/operators',
      headers: auth(customer),
      remoteAddress: customer.ip,
    });

    expect(response.statusCode).toBe(200);
    const amounts = [1500, 2000, 3000, 5000].map((amount) => ({ amount, currency: 'BRL' }));
    expect(response.json()).toEqual({
      operators: [
        { id: 'onda-movel', name: 'Onda Móvel', initials: 'OM', amounts },
        { id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC', amounts },
        { id: 'rede-nova', name: 'Rede Nova', initials: 'RN', amounts },
      ],
    });
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/top-ups/operators' });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /v1/top-ups', () => {
  it('tops up: 201 with exactly the approved fields, the number masked (READ-02)', async () => {
    const customer = await newCustomer();

    const response = await topUp(customer);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      id: expect.any(String) as string,
      operator: { id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC' },
      phoneMasked: '(11) *****-0001',
      amount: { amount: 3000, currency: 'BRL' },
      status: 'COMPLETED',
      createdAt: expect.any(String) as string,
    });
  });

  it('takes the amount from the balance and shows it on the statement, with its receipt', async () => {
    const customer = await newCustomer();
    const before = await availableCents(customer);

    const id = (await topUp(customer)).json<{ id: string }>().id;

    expect(await availableCents(customer)).toBe(before - 3000);
    const statement = await app.inject({
      method: 'GET',
      url: '/v1/me/statement',
      headers: auth(customer),
      remoteAddress: customer.ip,
    });
    const [latest] = statement.json<{ items: Record<string, unknown>[] }>().items;
    expect(latest).toMatchObject({
      kind: 'TOP_UP',
      direction: 'OUT',
      amount: { amount: 3000, currency: 'BRL' },
      counterparty: { name: 'Pulso Celular', documentMasked: '(11) *****-0001' },
      transferId: null,
      topUpId: id,
    });
  });

  it('keeps the number only encrypted and masked, never in the logs (TOP-01, MOB-02)', async () => {
    const customer = await newCustomer();

    const id = (await topUp(customer)).json<{ id: string }>().id;

    const { rows } = await pool.query<{ phone_ciphertext: Buffer; phone_masked: string }>(
      'SELECT phone_ciphertext, phone_masked FROM top_ups.top_ups WHERE id = $1',
      [id],
    );
    expect(rows[0]?.phone_masked).toBe('(11) *****-0001');
    expect(rows[0]?.phone_ciphertext.toString('latin1')).not.toContain('11900000001');
    expect(logs.raw()).not.toMatch(/90000-?0001/);
  });

  it('audits the top-up without the number (PIX-09)', async () => {
    const customer = await newCustomer();

    const id = (await topUp(customer)).json<{ id: string }>().id;

    const { rows } = await pool.query<{ action: string; metadata: Record<string, unknown> }>(
      "SELECT action, metadata FROM audit.audit_events WHERE subject_type = 'TOP_UP' AND subject_id = $1",
      [id],
    );
    expect(rows).toEqual([
      { action: 'TOP_UP_COMPLETED', metadata: { operatorId: 'pulso-celular', amountCents: 3000 } },
    ]);
  });

  it.each([
    ['a real-looking number', { phoneNumber: '11987654321' }, 'InvalidPhoneNumber'],
    ['an unknown operator', { operatorId: 'vivo' }, 'UnknownTopUpOperator'],
    ['an amount not offered', { amount: { amount: 2500, currency: 'BRL' } }, 'InvalidTopUpAmount'],
  ])('refuses %s with 422 and moves no money', async (_case, payload, code) => {
    const customer = await newCustomer();
    const before = await availableCents(customer);

    const response = await topUp(customer, payload);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code });
    expect(await availableCents(customer)).toBe(before);
  });

  it('refuses a wrong PIN with the attempts left, and moves no money (PIX-05)', async () => {
    const customer = await newCustomer();
    const before = await availableCents(customer);

    const response = await topUp(customer, { pin: '0000' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 2 });
    expect(await availableCents(customer)).toBe(before);
  });

  it('counts a wrong PIN even when the key is repeated: no free guesses', async () => {
    const customer = await newCustomer();
    const key = randomUUID();
    await topUp(customer, { pin: '0000' }, key);

    const repeated = await topUp(customer, { pin: '0000' }, key);
    const next = await topUp(customer, { pin: '1111' });

    expect(repeated.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 2 });
    expect(next.json()).toMatchObject({ code: 'PinIncorrect', remainingAttempts: 1 });
  });

  it('refuses what passes R$ 200 in the day, saying what is left (TopUpLimitExceeded)', async () => {
    const customer = await newCustomer();
    for (let i = 0; i < 4; i++) {
      expect(
        (await topUp(customer, { amount: { amount: 5000, currency: 'BRL' } })).statusCode,
      ).toBe(201);
    }

    const response = await topUp(customer, { amount: { amount: 1500, currency: 'BRL' } });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: 'TopUpLimitExceeded',
      limitCents: 20000,
      remainingCents: 0,
    });
  });

  it('refuses a balance that does not cover it (InsufficientFunds)', async () => {
    const customer = await newCustomer();
    await leaveOnly(customer, 1000);

    const response = await topUp(customer);

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'InsufficientFunds' });
    expect(await availableCents(customer)).toBe(1000);
  });

  it('requires an Idempotency-Key', async () => {
    const customer = await newCustomer();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/top-ups',
      headers: auth(customer),
      remoteAddress: customer.ip,
      payload: {
        operatorId: 'pulso-celular',
        phoneNumber: PHONE,
        amount: { amount: 3000, currency: 'BRL' },
        pin: PIN,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/top-ups',
      headers: { 'idempotency-key': randomUUID() },
      payload: {},
    });

    expect(response.statusCode).toBe(401);
  });

  describe('idempotency (TOP-02)', () => {
    it('tops up once for the same key, giving the same answer', async () => {
      const customer = await newCustomer();
      const before = await availableCents(customer);
      const key = randomUUID();

      const first = await topUp(customer, {}, key);
      const second = await topUp(customer, {}, key);

      expect(second.statusCode).toBe(201);
      expect(second.json()).toEqual(first.json());
      expect(await availableCents(customer)).toBe(before - 3000);
    });

    it('refuses the same key with another top-up (IdempotencyKeyReused)', async () => {
      const customer = await newCustomer();
      const key = randomUUID();
      await topUp(customer, {}, key);

      const response = await topUp(customer, { amount: { amount: 5000, currency: 'BRL' } }, key);

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({ code: 'IdempotencyKeyReused' });
    });
  });

  describe('concurrency (TOP-02; database.md 7)', () => {
    it('spends a balance once: 2 × R$ 30 at once over R$ 40', async () => {
      const customer = await newCustomer();
      await leaveOnly(customer, 4000);

      const responses = await Promise.all([topUp(customer), topUp(customer)]);

      expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 422]);
      expect(responses.find((r) => r.statusCode === 422)?.json()).toMatchObject({
        code: 'InsufficientFunds',
      });
      expect(await availableCents(customer)).toBe(1000);
    });

    it('lets only one of two top-ups through the day limit: R$ 150 spent, 2 × R$ 50 at once', async () => {
      const customer = await newCustomer();
      for (let i = 0; i < 3; i++) {
        await topUp(customer, { amount: { amount: 5000, currency: 'BRL' } });
      }

      const fifty = { amount: { amount: 5000, currency: 'BRL' } };
      const responses = await Promise.all([topUp(customer, fifty), topUp(customer, fifty)]);

      expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 422]);
      expect(responses.find((r) => r.statusCode === 422)?.json()).toMatchObject({
        code: 'TopUpLimitExceeded',
      });
    });
  });
});

describe('GET /v1/top-ups/{topUpId}', () => {
  it('shows the owner the receipt, the same as the top-up answer', async () => {
    const customer = await newCustomer();
    const created = await topUp(customer);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/top-ups/${created.json<{ id: string }>().id}`,
      headers: auth(customer),
      remoteAddress: customer.ip,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created.json());
  });

  it("answers another customer's top-up as not found (IDOR, READ-01)", async () => {
    const owner = await newCustomer();
    const intruder = await newCustomer();
    const created = await topUp(owner);

    const response = await app.inject({
      method: 'GET',
      url: `/v1/top-ups/${created.json<{ id: string }>().id}`,
      headers: auth(intruder),
      remoteAddress: intruder.ip,
    });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('90000');
  });

  it('answers an id that does not exist as not found', async () => {
    const customer = await newCustomer();

    const response = await app.inject({
      method: 'GET',
      url: `/v1/top-ups/${randomUUID()}`,
      headers: auth(customer),
      remoteAddress: customer.ip,
    });

    expect(response.statusCode).toBe(404);
  });
});
