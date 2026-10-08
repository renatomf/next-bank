import { afterAll, describe, expect, it } from 'vitest';
import { InsufficientFunds } from '../../../../src/modules/payments/domain/errors.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { type Customer, pgPixStack } from './pg-pix-stack.ts';

// The Pix under concurrency against the real database (database.md 7 and 11;
// ADR 0007; PIX-03): T-DB-08, T-DB-09 and T-DB-14 through the Pix use cases,
// with the PIN row lock and the ordered ledger locks of production. 15:00 UTC
// is 12:00 in São Paulo: the day limit applies.
const pool = createPool(testDatabaseUrl());
const pix = pgPixStack(pool, new FixedClock(new Date('2026-10-08T15:00:00.000Z')));

afterAll(async () => {
  await pool.end();
});

const STARTING_BALANCE = 1_000_000n;
/** The connections of the pool (shared/db.ts): more at once would only wait for one. */
const POOL_SIZE = 10;

/** Runs the tasks with at most [width] at a time, like a busy client population. */
async function inParallel<T>(tasks: (() => Promise<T>)[], width: number): Promise<T[]> {
  const results: T[] = [];
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      const task = tasks[index];
      if (task) results[index] = await task();
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}

async function ledgerAccountOf(customer: Customer): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT l.id FROM ledger.ledger_accounts l
     JOIN accounts.accounts a ON l.code = 'customer:' || a.id
     WHERE a.holder_user_id = $1`,
    [customer.userId],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error('customer without a ledger account');
  return id;
}

/** Materialized balance and the sum of the postings of one ledger account. */
async function balances(ledgerId: string): Promise<{ materialized: bigint; posted: bigint }> {
  const { rows } = await pool.query<{ materialized: string; posted: string }>(
    `SELECT a.posted_balance AS materialized,
            coalesce(sum(CASE p.direction WHEN 'C' THEN p.amount ELSE -p.amount END), 0) AS posted
       FROM ledger.ledger_accounts a
       LEFT JOIN ledger.postings p ON p.ledger_account_id = a.id
      WHERE a.id = $1
      GROUP BY a.id`,
    [ledgerId],
  );
  const row = rows[0];
  if (!row) throw new Error(`ledger account ${ledgerId} not found`);
  return { materialized: BigInt(row.materialized), posted: BigInt(row.posted) };
}

async function expectReconciled(customers: Customer[]): Promise<bigint> {
  let total = 0n;
  for (const customer of customers) {
    const { materialized, posted } = await balances(await ledgerAccountOf(customer));
    expect(materialized).toBe(posted);
    total += materialized;
  }
  return total;
}

/** Leaves the payer with exactly [left] cents, paying the rest to [to]. */
async function drain(from: Customer, to: Customer, left: bigint): Promise<void> {
  let remaining = Number(STARTING_BALANCE - left);
  while (remaining > 0) {
    const cents = Math.min(remaining, 500_000);
    const view = await pix.authorize(from, await pix.create(from, to, cents));
    expect(view.status).toBe('COMPLETED');
    remaining -= cents;
  }
}

describe('Pix under concurrency on Postgres', () => {
  // PIX-03: the same balance is spent once.
  it('spends R$ 100,00 once with two R$ 80,00 Pix authorized at once (T-DB-08)', async () => {
    const payer = await pix.newCustomer();
    const payee = await pix.newCustomer();
    await drain(payer, payee, 10_000n);
    const first = await pix.create(payer, payee, 8_000);
    const second = await pix.create(payer, payee, 8_000);

    const results = await Promise.all([pix.authorize(payer, first), pix.authorize(payer, second)]);

    expect(results.map((r) => r.status).sort()).toEqual(['COMPLETED', 'FAILED']);
    expect(results.find((r) => r.status === 'FAILED')?.failureReason).toBe('INSUFFICIENT_FUNDS');
    const { materialized } = await balances(await ledgerAccountOf(payer));
    expect(materialized).toBe(2_000n);
    await expectReconciled([payer, payee]);
  });

  // Locks by account id: a Pix A→B and a Pix B→A never wait on each other in a cycle.
  it('runs 50 Pix A→B and 50 B→A at once without a deadlock (T-DB-09)', async () => {
    const a = await pix.newCustomer();
    const b = await pix.newCustomer();
    // Alternated, so opposite directions compete for the same two accounts at once;
    // as many at a time as the pool has connections, like the API under load.
    const pairs = Array.from({ length: 100 }, (_, index) =>
      index % 2 === 0 ? ([a, b] as const) : ([b, a] as const),
    );
    const ids = await inParallel(
      pairs.map(
        ([from, to]) =>
          () =>
            pix.create(from, to, 1_000),
      ),
      POOL_SIZE,
    );

    const results = await inParallel(
      pairs.map(
        ([from], index) =>
          () =>
            pix.authorize(from, ids[index] ?? ''),
      ),
      POOL_SIZE,
    );

    expect(results.every((r) => r.status === 'COMPLETED')).toBe(true);
    expect(await expectReconciled([a, b])).toBe(2n * STARTING_BALANCE);
  });

  // Every balance equals the sum of its postings, and an internal Pix never creates
  // or destroys money (D11: the use cases with a fast PIN hash).
  it('reconciles every account after 1.000 random Pix among 10 customers (T-DB-14)', async () => {
    const customers = await Promise.all(Array.from({ length: 10 }, () => pix.newCustomer()));
    const pick = (): Customer => {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      if (!customer) throw new Error('no customer to pick');
      return customer;
    };
    const tasks = Array.from({ length: 1_000 }, () => async () => {
      const from = pick();
      let to = pick();
      while (to === from) to = pick();
      const cents = 1 + Math.floor(Math.random() * 300_000);
      let transferId: string;
      try {
        transferId = await pix.create(from, to, cents);
      } catch (error) {
        // The early check of creation: above the balance, no Pix is created.
        if (error instanceof InsufficientFunds) return null;
        throw error;
      }
      return pix.authorize(from, transferId);
    });

    const outcomes = await inParallel(tasks, POOL_SIZE);
    const results = outcomes.filter((outcome) => outcome !== null);

    // Some are refused at creation, some fail at authorization after a race: both happen.
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.status === 'COMPLETED' || r.status === 'FAILED')).toBe(true);
    expect(await expectReconciled(customers)).toBe(10n * STARTING_BALANCE);
    const ids = results.map((r) => r.id);
    const { rows } = await pool.query<{ completed: number; entries: number }>(
      `SELECT (SELECT count(*) FROM payments.pix_transfers
                WHERE id = ANY($1::uuid[]) AND status = 'COMPLETED')::int AS completed,
              (SELECT count(*) FROM ledger.journal_entries
                WHERE reference_type = 'PIX_TRANSFER' AND reference_id = ANY($1::uuid[]))::int AS entries`,
      [ids],
    );
    // One entry per completed Pix, none for a failed one.
    expect(rows[0]?.entries).toBe(rows[0]?.completed);
    expect(rows[0]?.completed).toBe(results.filter((r) => r.status === 'COMPLETED').length);
  }, 120_000);
});
