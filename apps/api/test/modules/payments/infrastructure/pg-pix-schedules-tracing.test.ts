import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool } from '../../../../src/shared/db.ts';
import { inRootSpan } from '../../../../src/shared/infrastructure/tracing.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import { isChildOf, recordSpans } from '../../../tracing.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { AURORA_EMAIL, AURORA_KEY, FakeSpi } from '../application/fakes.ts';
import { type Customer, pgPixStack } from './pg-pix-stack.ts';

// The trace of the scheduled Pix (v1.2.0 plan, task 8): each occurrence is a
// transaction of its own under the round of the worker, named by its
// schedule; one to another bank goes on through the outbox as any Pix does
// (from there to the SPI and the webhook, the trace of the Pix to another
// bank shows it). Other tests' schedules share the database, so each test
// looks at the spans of its own schedules only.
const { spans, traceOf } = recordSpans();
const pool = createPool(testDatabaseUrl());
const clock = new FixedClock(new Date());

const noonOf = (date: string) => new Date(`${date}T12:00:00-03:00`);
const FIRST_DATE = '2026-11-12';

beforeEach(() => {
  clock.current = noonOf('2026-11-03');
});
afterAll(async () => {
  await pool.end();
});

const spi = new FakeSpi();
spi.keys.set(AURORA_EMAIL, AURORA_KEY);
const pix = pgPixStack(pool, clock, { spi });

/** Rounds of the worker, each in its span as the server runs it, until nothing is due. */
async function runRoundsUntilDone(): Promise<void> {
  for (let round = 0; round < 100; round += 1) {
    if ((await inRootSpan('scheduled Pix', () => pix.runDueSchedules())) === 0) return;
  }
  throw new Error('The worker never ran out of schedules due');
}

/** The transaction that paid an occurrence of [scheduleId]. */
const occurrenceOf = (scheduleId: string) =>
  spans().find(
    (span) => span.name === 'transaction' && span.attributes['nextbank.schedule.id'] === scheduleId,
  );

const rounds = () => spans().filter((span) => span.name === 'scheduled Pix');

const cpfKey = (customer: Customer) => ({ type: 'CPF' as const, value: customer.cpf });

describe('the trace of the scheduled Pix', () => {
  it('traces an occurrence to another bank from the round to the outbox', async () => {
    const ana = await pix.newCustomer();
    const scheduled = await pix.schedule(ana, { type: 'EMAIL', value: AURORA_EMAIL }, 2_000, {
      firstDate: FIRST_DATE,
    });

    clock.current = noonOf(FIRST_DATE);
    await runRoundsUntilDone();
    await pix.deliverOutbox();

    const occurrence = occurrenceOf(scheduled.id);
    const round = rounds().find((span) => isChildOf(occurrence, span));
    expect(round?.parentSpanContext).toBeUndefined();
    expect(occurrence?.attributes).toMatchObject({
      'nextbank.schedule.id': scheduled.id,
      'nextbank.pix.status': 'PROCESSING',
    });
    const delivery = traceOf(occurrence).find((span) => span.name === 'outbox pix.send-external');
    expect(isChildOf(delivery, occurrence)).toBe(true);
    expect(JSON.stringify(traceOf(occurrence).map((span) => span.attributes))).not.toContain(
      'aurora',
    );
  });

  it('traces an occurrence to next bank as one transaction with its Pix', async () => {
    const [ana, bia] = [await pix.newCustomer(), await pix.newCustomer()];
    const scheduled = await pix.schedule(ana, cpfKey(bia), 3_000, { firstDate: FIRST_DATE });

    clock.current = noonOf(FIRST_DATE);
    await runRoundsUntilDone();

    expect(occurrenceOf(scheduled.id)?.attributes).toMatchObject({
      'nextbank.schedule.id': scheduled.id,
      'nextbank.pix.transfer_id': expect.any(String) as string,
      'nextbank.pix.status': 'COMPLETED',
    });
  });

  it('marks an occurrence that fails with the status of its Pix, not a free text', async () => {
    const [ana, bia] = [await pix.newCustomer(), await pix.newCustomer()];
    const scheduled = await pix.schedule(ana, cpfKey(bia), 3_000, { firstDate: FIRST_DATE });
    // Ana spends everything before the date: the occurrence finds no balance.
    for (let left = 1_000_000; left > 0; left -= 500_000) {
      await pix.authorize(ana, await pix.create(ana, bia, Math.min(left, 500_000)));
    }

    clock.current = noonOf(FIRST_DATE);
    await runRoundsUntilDone();

    expect(occurrenceOf(scheduled.id)?.attributes).toMatchObject({
      'nextbank.pix.status': 'FAILED',
    });
  });

  it('gives each occurrence of a round a span of its own under the round', async () => {
    const [ana, bia] = [await pix.newCustomer(), await pix.newCustomer()];
    const first = await pix.schedule(ana, cpfKey(bia), 1_000, { firstDate: FIRST_DATE });
    const second = await pix.schedule(bia, cpfKey(ana), 1_000, { firstDate: FIRST_DATE });

    clock.current = noonOf(FIRST_DATE);
    await runRoundsUntilDone();

    const [one, other] = [occurrenceOf(first.id), occurrenceOf(second.id)];
    expect(one?.spanContext().spanId).not.toBe(other?.spanContext().spanId);
    for (const occurrence of [one, other]) {
      expect(rounds().some((round) => isChildOf(occurrence, round))).toBe(true);
    }
  });
});
