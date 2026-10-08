import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../../src/shared/infrastructure/system-ports.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

// GET /v1/me/statement against the real database (domain-model.md 8.1;
// database.md 8; READ-01 to READ-04; T-DB-12).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
let app: FastifyInstance;
let nextIp = 1;

// Postings are written straight through the ledger, with a fixed clock: many
// items share a timestamp, so the cursor must break ties by id. The clock is in
// the future, so the registration funding, at real time, is always the oldest.
const clock = new FixedClock(new Date('2030-01-01T12:00:00.000Z'));
const ledger = createLedgerModule({ clock, ids: new UuidV7Generator() });
const unitOfWork = new PgUnitOfWork(pool);

beforeAll(() => {
  app = buildApp({ pool, logStream: captureLogs().stream, security });
});

afterAll(async () => {
  await app.close();
});

interface Customer {
  accessToken: string;
  accountId: string;
}

async function newCustomer(): Promise<Customer> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email,
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: `198.18.6.${String(nextIp++)}`,
  });
  expect(response.statusCode).toBe(201);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT a.id FROM accounts.accounts a
     JOIN identity.users u ON u.id = a.holder_user_id WHERE u.email = $1`,
    [email],
  );
  return {
    accessToken: response.json<{ accessToken: string }>().accessToken,
    accountId: rows[0]?.id ?? '',
  };
}

/** A Pix posted in the ledger, as an authorization would. */
async function pix(from: Customer, to: Customer, cents: bigint): Promise<string> {
  const transferId = randomUUID();
  await unitOfWork.run((tx) =>
    ledger.customerAccounts.transferPix(tx, {
      transferId,
      payerAccountId: from.accountId,
      payeeAccountId: to.accountId,
      amount: Money.of(cents),
      payer: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
      payee: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
    }),
  );
  return transferId;
}

interface Page {
  items: { id: string; kind: string; transferId: string | null }[];
  nextCursor: string | null;
}

function statement(customer: Customer, query = '') {
  return app.inject({
    method: 'GET',
    url: `/v1/me/statement${query}`,
    headers: { authorization: `Bearer ${customer.accessToken}` },
  });
}

async function page(customer: Customer, cursor: string | null = null): Promise<Page> {
  const response = await statement(customer, cursor ? `?cursor=${cursor}` : '');
  expect(response.statusCode).toBe(200);
  return response.json<Page>();
}

describe('GET /v1/me/statement', () => {
  it('shows a new customer the demo funding, with exactly the approved fields (READ-02)', async () => {
    const customer = await newCustomer();

    const response = await statement(customer);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: expect.any(String) as string,
          occurredAt: expect.any(String) as string,
          kind: 'DEMO_FUNDING',
          direction: 'IN',
          amount: { amount: 1_000_000, currency: 'BRL' },
          counterparty: { name: 'next bank', documentMasked: null },
          transferId: null,
        },
      ],
      nextCursor: null,
    });
  });

  it('shows the payer a sent Pix with its receipt link, and the payee a received one', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    clock.current = new Date('2030-01-01T12:10:00.000Z');
    const transferId = await pix(a, b, 8_000n);

    const [sent] = (await page(a)).items;
    const [received] = (await page(b)).items;

    expect(sent).toMatchObject({
      kind: 'PIX_SENT',
      direction: 'OUT',
      amount: { amount: 8_000, currency: 'BRL' },
      counterparty: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
      transferId,
    });
    expect(received).toMatchObject({
      kind: 'PIX_RECEIVED',
      direction: 'IN',
      counterparty: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
      transferId: null,
    });
  });

  it('pages by 20 newest first, breaking ties by id, without repeating an item', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    clock.current = new Date('2030-01-01T13:00:00.000Z');
    for (let i = 0; i < 24; i++) await pix(a, b, 100n);

    const first = await page(a);
    const second = await page(a, first.nextCursor);

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
    expect(second.items.at(-1)?.kind).toBe('DEMO_FUNDING');
  });

  // T-DB-12: a Pix that lands while the customer pages through goes before page 1.
  it('neither repeats nor skips items when a Pix lands between two pages (T-DB-12)', async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    clock.current = new Date('2030-01-01T14:00:00.000Z');
    for (let i = 0; i < 24; i++) await pix(a, b, 100n);
    const first = await page(a);

    clock.current = new Date('2030-01-01T14:30:00.000Z');
    await pix(a, b, 100n);
    const second = await page(a, first.nextCursor);

    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
    expect(second.items.at(-1)?.kind).toBe('DEMO_FUNDING');
  });

  // READ-01: every customer sees only their own account.
  it("never shows another customer's items", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    clock.current = new Date('2030-01-01T15:00:00.000Z');
    await pix(a, b, 100n);
    const stranger = await newCustomer();

    const items = (await page(stranger)).items;

    expect(items.map((item) => item.kind)).toEqual(['DEMO_FUNDING']);
  });

  // READ-03: a cursor only positions the reader in their own list.
  it("returns nothing of A to B with a cursor taken from A's statement", async () => {
    const a = await newCustomer();
    const b = await newCustomer();
    clock.current = new Date('2030-01-01T16:00:00.000Z');
    for (let i = 0; i < 24; i++) await pix(a, b, 100n);
    const cursorOfA = (await page(a)).nextCursor;
    const stranger = await newCustomer();

    const items = (await page(stranger, cursorOfA)).items;

    expect(items.every((item) => item.kind === 'DEMO_FUNDING')).toBe(true);
  });

  it.each([
    ['a cursor that is not base64url JSON', '?cursor=not-a-cursor'],
    [
      'a cursor with a forged shape',
      `?cursor=${Buffer.from('{"t":"x","i":"y"}').toString('base64url')}`,
    ],
    [
      'a cursor with an impossible date',
      `?cursor=${Buffer.from(
        JSON.stringify({ t: '2030-13-45T25:61:61.000000Z', i: randomUUID() }),
      ).toString('base64url')}`,
    ],
    ['a page size (READ-04)', '?limit=10000'],
    ['an account id (READ-01)', `?accountId=${randomUUID()}`],
  ])('refuses %s (InvalidRequest)', async (_case, query) => {
    const customer = await newCustomer();

    const response = await statement(customer, query);

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('InvalidRequest');
  });

  it('requires authentication (Unauthenticated)', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/me/statement' });

    expect(response.statusCode).toBe(401);
  });
});
