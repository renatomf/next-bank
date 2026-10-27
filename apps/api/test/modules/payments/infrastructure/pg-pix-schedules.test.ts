import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { OutboxMessage } from '../../../../src/shared/application/outbox.ts';
import type { Transaction } from '../../../../src/shared/application/ports.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { AURORA_EMAIL, AURORA_KEY, FakeSpi } from '../application/fakes.ts';
import { type Customer, pgPixStack } from './pg-pix-stack.ts';

// The scheduled Pix against the real database (v1.2.0 plan, task 7): the
// schedule and its occurrences as stored, and the races of EXT-05 and EXT-06
// with the row locks of production. Other tests' schedules share the
// database, so each test asserts on its own schedules only.
const pool = createPool(testDatabaseUrl());
const clock = new FixedClock(new Date());

/** Noon in São Paulo on [date]: in the daytime, when occurrences run (S3). */
const noonOf = (date: string) => new Date(`${date}T12:00:00-03:00`);
const SCHEDULED_ON = noonOf('2026-10-27');
const FIRST_DATE = '2026-11-05';

beforeEach(() => {
  clock.current = SCHEDULED_ON;
});
afterAll(async () => {
  await pool.end();
});

/** An outbox that fails its first message, like the connection lost mid-occurrence. */
class FailingOnceOutbox {
  readonly messages: OutboxMessage[] = [];
  failNext = true;
  enqueue(_tx: Transaction, message: OutboxMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('Connection terminated'));
    }
    this.messages.push(message);
    return Promise.resolve();
  }
}

const spi = new FakeSpi();
spi.keys.set(AURORA_EMAIL, AURORA_KEY);
const outbox = new FailingOnceOutbox();
const pix = pgPixStack(pool, clock, { spi, outbox });

/**
 * Rounds of the worker until nothing due is left: other tests' schedules
 * may fill a round of 20 before this test's is reached.
 */
async function runUntilDone(): Promise<void> {
  for (let round = 0; round < 100; round += 1) {
    if ((await pix.runDueSchedules()) === 0) return;
  }
  throw new Error('The worker never ran out of schedules due');
}

async function balanceOf(customer: Customer): Promise<bigint> {
  const { rows } = await pool.query<{ balance: string }>(
    `SELECT l.posted_balance AS balance FROM ledger.ledger_accounts l
     JOIN accounts.accounts a ON l.code = 'customer:' || a.id
     WHERE a.holder_user_id = $1`,
    [customer.userId],
  );
  const balance = rows[0]?.balance;
  if (balance === undefined) throw new Error('customer without a ledger account');
  return BigInt(balance);
}

async function occurrencesOf(scheduleId: string) {
  const { rows } = await pool.query<{ sequence: number; transfer_id: string }>(
    `SELECT sequence, transfer_id FROM payments.pix_schedule_occurrences
     WHERE schedule_id = $1 ORDER BY sequence`,
    [scheduleId],
  );
  return rows;
}

async function twoCustomers(): Promise<[Customer, Customer]> {
  return [await pix.newCustomer(), await pix.newCustomer()];
}

const cpfKey = (customer: Customer) => ({ type: 'CPF' as const, value: customer.cpf });

describe('scheduled Pix on Postgres', () => {
  it('keeps the schedule as scheduled and pays it on its date', async () => {
    const [ana, bia] = await twoCustomers();
    const scheduled = await pix.schedule(ana, cpfKey(bia), 15_000, {
      firstDate: FIRST_DATE,
      recurrence: { frequency: 'MONTHLY', times: 2 },
    });
    const before = await balanceOf(ana);

    clock.current = noonOf(FIRST_DATE);
    await runUntilDone();

    expect(await balanceOf(ana)).toBe(before - 15_000n);
    const detail = await pix.schedules.get({ userId: ana.userId, scheduleId: scheduled.id });
    expect(detail).toMatchObject({
      id: scheduled.id,
      status: 'ACTIVE',
      firstDate: FIRST_DATE,
      recurrence: { frequency: 'MONTHLY', times: 2 },
      nextOccurrenceDate: '2026-12-05',
      lastOccurrenceDate: '2026-12-05',
    });
    expect(detail.occurrences).toEqual([
      expect.objectContaining({ sequence: 1, date: FIRST_DATE, status: 'COMPLETED' }),
    ]);
  });

  it('sends an occurrence to another bank with the key sealed when scheduled', async () => {
    const ana = await pix.newCustomer();
    outbox.failNext = false;
    const scheduled = await pix.schedule(ana, { type: 'EMAIL', value: AURORA_EMAIL }, 2_000, {
      firstDate: FIRST_DATE,
    });

    clock.current = noonOf(FIRST_DATE);
    await runUntilDone();

    const [occurrence] = await occurrencesOf(scheduled.id);
    const { rows } = await pool.query<{ status: string; payee_key_ciphertext: Buffer | null }>(
      'SELECT status, payee_key_ciphertext FROM payments.pix_transfers WHERE id = $1',
      [occurrence?.transfer_id],
    );
    expect(rows[0]?.status).toBe('PROCESSING');
    expect(rows[0]?.payee_key_ciphertext?.includes(Buffer.from(AURORA_EMAIL))).toBe(false);
    expect(outbox.messages.at(-1)).toMatchObject({
      payload: { transferId: occurrence?.transfer_id },
    });
  });

  // EXT-05: two instances of the worker in the same round.
  it('pays an occurrence once when two workers run at the same time', async () => {
    const [ana, bia] = await twoCustomers();
    const scheduled = await pix.schedule(ana, cpfKey(bia), 3_000, { firstDate: FIRST_DATE });
    const before = await balanceOf(ana);

    clock.current = noonOf(FIRST_DATE);
    await Promise.all([runUntilDone(), runUntilDone(), runUntilDone()]);

    expect(await occurrencesOf(scheduled.id)).toHaveLength(1);
    expect(await balanceOf(ana)).toBe(before - 3_000n);
  });

  // EXT-05: the worker dies after the debit; nothing of it stays.
  it('undoes an occurrence that fails midway, and pays it once in the next round', async () => {
    const ana = await pix.newCustomer();
    const scheduled = await pix.schedule(ana, { type: 'EMAIL', value: AURORA_EMAIL }, 4_000, {
      firstDate: FIRST_DATE,
    });
    const before = await balanceOf(ana);
    outbox.failNext = true;

    clock.current = noonOf(FIRST_DATE);
    await expect(runUntilDone()).rejects.toThrow('Connection terminated');
    expect(await occurrencesOf(scheduled.id)).toEqual([]);
    expect(await balanceOf(ana)).toBe(before);

    await runUntilDone();
    expect(await occurrencesOf(scheduled.id)).toHaveLength(1);
    expect(await balanceOf(ana)).toBe(before - 4_000n);
  });

  // EXT-05: an occurrence already recorded (a clock that went back, a date
  // recalculated) makes the insert fail, and the debit with it.
  it('never pays an occurrence already recorded', async () => {
    const [ana, bia] = await twoCustomers();
    const scheduled = await pix.schedule(ana, cpfKey(bia), 5_000, { firstDate: FIRST_DATE });
    clock.current = noonOf(FIRST_DATE);
    await runUntilDone();
    const before = await balanceOf(ana);
    // The schedule as if the worker had not moved it on.
    await pool.query(
      `UPDATE payments.pix_schedules
       SET status = 'ACTIVE', next_sequence = 1, next_occurrence_date = $2
       WHERE id = $1`,
      [scheduled.id, FIRST_DATE],
    );

    await expect(runUntilDone()).rejects.toThrow(/schedule_id/);

    expect(await occurrencesOf(scheduled.id)).toHaveLength(1);
    expect(await balanceOf(ana)).toBe(before);
    // Back as the worker left it, so no later round trips on it.
    await pool.query(
      `UPDATE payments.pix_schedules
       SET status = 'FINISHED', next_sequence = NULL, next_occurrence_date = NULL
       WHERE id = $1`,
      [scheduled.id],
    );
  });

  // EXT-06: the cancel locks the schedule as the worker does.
  it('makes a cancel wait for the occurrence that holds the schedule', async () => {
    const [ana, bia] = await twoCustomers();
    const scheduled = await pix.schedule(ana, cpfKey(bia), 1_000, {
      firstDate: FIRST_DATE,
      recurrence: { frequency: 'MONTHLY', times: 3 },
    });
    const worker = await pool.connect();
    try {
      await worker.query('BEGIN');
      await worker.query('SELECT id FROM payments.pix_schedules WHERE id = $1 FOR UPDATE', [
        scheduled.id,
      ]);
      let cancelled = false;
      const cancel = pix.cancelSchedule(ana, scheduled.id).then((view) => {
        cancelled = true;
        return view;
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(cancelled).toBe(false);

      await worker.query('COMMIT');
      await expect(cancel).resolves.toMatchObject({ status: 'CANCELLED' });
    } finally {
      worker.release();
    }

    clock.current = noonOf(FIRST_DATE);
    await runUntilDone();
    expect(await occurrencesOf(scheduled.id)).toEqual([]);
  });

  // EXT-06: and the worker passes over a schedule being cancelled.
  it('passes over a schedule another transaction holds, and never pays it once cancelled', async () => {
    const [ana, bia] = await twoCustomers();
    const scheduled = await pix.schedule(ana, cpfKey(bia), 1_000, { firstDate: FIRST_DATE });
    clock.current = noonOf(FIRST_DATE);
    const canceller = await pool.connect();
    try {
      await canceller.query('BEGIN');
      await canceller.query('SELECT id FROM payments.pix_schedules WHERE id = $1 FOR UPDATE', [
        scheduled.id,
      ]);

      await runUntilDone();
      expect(await occurrencesOf(scheduled.id)).toEqual([]);
      await canceller.query('ROLLBACK');
    } finally {
      canceller.release();
    }

    await pix.cancelSchedule(ana, scheduled.id);
    await runUntilDone();
    expect(await occurrencesOf(scheduled.id)).toEqual([]);
  });

  it('schedules once for one idempotency key, even at the same time (ADR 0007)', async () => {
    const [ana, bia] = await twoCustomers();
    const idempotencyKey = randomUUID();

    const answers = await Promise.all(
      [1, 2, 3].map(() =>
        pix
          .schedule(ana, cpfKey(bia), 1_000, { firstDate: FIRST_DATE, idempotencyKey })
          .catch((error: unknown) => error),
      ),
    );

    const page = await pix.schedules.list({ userId: ana.userId, after: null });
    expect(page.items).toHaveLength(1);
    // The others wait for the first, or are told it is still in progress.
    for (const answer of answers) {
      if (!(answer instanceof Error)) expect(answer).toEqual(page.items[0]);
      else expect(answer).toMatchObject({ code: 'RequestInProgress' });
    }
  });

  // PIX-03: the occurrence and a Pix by hand over the same money.
  it('lets only one of an occurrence and a Pix by hand spend the same balance', async () => {
    const [ana, bia] = await twoCustomers();
    const balance = await balanceOf(ana);
    const keep = 100_000n;
    // Leaves Ana with R$ 1.000,00 in two Pix within the daytime limit.
    for (let left = balance - keep; left > 0n; left -= 500_000n) {
      const cents = left > 500_000n ? 500_000 : Number(left);
      await pix.authorize(ana, await pix.create(ana, bia, cents));
    }
    const scheduled = await pix.schedule(ana, cpfKey(bia), 100_000, { firstDate: FIRST_DATE });
    clock.current = noonOf(FIRST_DATE);
    const byHand = await pix.create(ana, bia, 100_000);

    const [manual] = await Promise.all([pix.authorize(ana, byHand), runUntilDone()]);

    const detail = await pix.schedules.get({ userId: ana.userId, scheduleId: scheduled.id });
    const outcomes = [manual.status, detail.occurrences[0]?.status].sort();
    expect(outcomes).toEqual(['COMPLETED', 'FAILED']);
    expect(await balanceOf(ana)).toBe(0n);
  });

  it('pages the schedules by their position, even created at the same instant', async () => {
    const [ana, bia] = await twoCustomers();
    const ids: string[] = [];
    for (let i = 0; i < 21; i += 1) {
      ids.push((await pix.schedule(ana, cpfKey(bia), 100, { firstDate: FIRST_DATE })).id);
    }

    const first = await pix.schedules.list({ userId: ana.userId, after: null });
    const second = await pix.schedules.list({ userId: ana.userId, after: first.next });

    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(ids.reverse());
    expect(second.next).toBeNull();
  });
});
