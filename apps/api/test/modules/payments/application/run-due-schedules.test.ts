import { describe, expect, it } from 'vitest';
import { SEND_EXTERNAL_PIX } from '../../../../src/modules/payments/application/process-pix.ts';
import { RunDueSchedules } from '../../../../src/modules/payments/application/run-due-schedules.ts';
import type { PixPosting } from '../../../../src/modules/payments/application/ports.ts';
import {
  type CreatePixScheduleInput,
  PixSchedule,
} from '../../../../src/modules/payments/domain/pix-schedule.ts';
import type { Transaction } from '../../../../src/shared/application/ports.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import {
  AURORA_KEY,
  FakeLedger,
  FakeOutbox,
  FakeUnitOfWork,
  FixedEndToEndIds,
  twoCustomers,
} from './fakes.ts';

// The worker of the scheduled Pix (v1.2.0 plan, task 7): each occurrence due
// is paid once, without a PIN, through the same processing as an authorized
// Pix, in a transaction of its own (EXT-05); paid or failed, the schedule
// moves on (S5). Dates are São Paulo's (UTC−3).
const SCHEDULED_AT = new Date('2026-10-27T15:00:00.000Z');
/** Noon in São Paulo on [date]. */
const noonOf = (date: string) => new Date(`${date}T12:00:00-03:00`);

const MARINA = {
  accountId: 'account-b',
  name: 'Marina Costa',
  documentMasked: '***.456.789-**',
  keyType: 'CPF' as const,
  keyMasked: '***.456.789-**',
};

const CLARA = {
  accountId: null,
  bank: AURORA_KEY.bank,
  name: AURORA_KEY.owner.name,
  documentMasked: AURORA_KEY.owner.documentMasked,
  keyType: 'EMAIL' as const,
  keyMasked: 'cl***@example.com',
};

/** A ledger that fails like a lost connection when posting for [failingPayer]. */
class BrokenLedger extends FakeLedger {
  failingPayer: string | null = null;
  override postPixTransfer(tx: Transaction, posting: PixPosting): Promise<void> {
    if (posting.payerAccountId === this.failingPayer) {
      return Promise.reject(new Error('Connection terminated'));
    }
    return super.postPixTransfer(tx, posting);
  }
}

function setup(now = noonOf('2026-11-05')) {
  const world = twoCustomers();
  const ledger = new BrokenLedger();
  ledger.balances.set('account-a', Money.of(100_000n));
  const outbox = new FakeOutbox();
  const clock = new FixedClock(now);
  const unitOfWork = new FakeUnitOfWork();
  const ids = new SequentialIds();
  const run = new RunDueSchedules({
    unitOfWork,
    repositories: world.repositories,
    accounts: world.accounts,
    identity: world.identity,
    ledger,
    endToEndIds: new FixedEndToEndIds(),
    outbox,
    clock,
    ids,
  });

  function schedule(overrides: Partial<CreatePixScheduleInput> = {}): string {
    const { state } = PixSchedule.create({
      id: `schedule-${String(world.repositories.schedules.length + 1)}`,
      payerAccountId: 'account-a',
      payee: MARINA,
      amount: Money.of(15_000n),
      description: 'Aluguel',
      firstDate: '2026-11-05',
      recurrence: { frequency: 'MONTHLY', times: 3 },
      now: SCHEDULED_AT,
      ...overrides,
    });
    world.repositories.schedules.push(state);
    return state.id;
  }

  return { ...world, ledger, outbox, clock, unitOfWork, run, schedule };
}

describe('RunDueSchedules', () => {
  it('pays an occurrence due today without a PIN, and moves the schedule on', async () => {
    const { run, schedule, repositories, ledger, identity } = setup();
    schedule();

    await expect(run.runOnce()).resolves.toBe(1);

    expect(ledger.posted).toEqual([
      {
        transferId: 'id-1',
        payerAccountId: 'account-a',
        payeeAccountId: 'account-b',
        amount: Money.of(15_000n),
        payer: { name: 'Ana Souza', documentMasked: '***.444.777-**' },
        payee: { name: 'Marina Costa', documentMasked: '***.456.789-**' },
      },
    ]);
    expect(repositories.transfers).toEqual([
      expect.objectContaining({
        id: 'id-1',
        payerAccountId: 'account-a',
        payee: MARINA,
        amount: Money.of(15_000n),
        description: 'Aluguel',
        status: 'COMPLETED',
        authorizedAt: noonOf('2026-11-05'),
      }),
    ]);
    expect(repositories.occurrences).toEqual([
      {
        id: 'id-2',
        scheduleId: 'schedule-1',
        sequence: 1,
        occurrenceDate: '2026-11-05',
        transferId: 'id-1',
        executedAt: noonOf('2026-11-05'),
      },
    ]);
    expect(repositories.schedules[0]).toMatchObject({
      nextSequence: 2,
      nextOccurrenceDate: '2026-12-05',
    });
    expect(identity.pinsChecked).toEqual([]);
  });

  it('records the outcome as the system, tied to the schedule (PIX-09)', async () => {
    const { run, schedule, repositories } = setup();
    schedule();

    await run.runOnce();

    expect(repositories.auditEvents).toEqual([
      {
        id: 'id-3',
        occurredAt: noonOf('2026-11-05'),
        actorType: 'SYSTEM',
        actorId: null,
        action: 'PIX_COMPLETED',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'id-1',
        requestId: null,
        metadata: {
          scheduleId: 'schedule-1',
          sequence: 1,
          amountCents: 15_000,
          endToEndId: 'E00000000202610081501a1B2c3D4e5F',
        },
      },
    ]);
  });

  it('sends an occurrence to another bank through the outbox, with the sealed key', async () => {
    const { run, schedule, repositories, ledger, outbox } = setup();
    const sealed = { ciphertext: new TextEncoder().encode('sealed(EMAIL:clara)'), keyVersion: 1 };
    const id = schedule({ payee: CLARA });
    repositories.scheduleKeys.set(id, sealed);

    await run.runOnce();

    expect(ledger.postedExternal).toHaveLength(1);
    expect(repositories.transfers[0]).toMatchObject({
      status: 'PROCESSING',
      endToEndId: 'E00000000202610081501a1B2c3D4e5F',
    });
    expect(repositories.payeeKeys.get('id-1')).toEqual(sealed);
    expect(outbox.messages).toEqual([
      { type: SEND_EXTERNAL_PIX, payload: { transferId: 'id-1' }, requestId: null },
    ]);
    expect(repositories.auditEvents[0]?.action).toBe('PIX_SENT');
  });

  // S5: it fails once, with the Pix's reason, and the schedule goes on.
  it('records an occurrence without balance as failed, and moves on', async () => {
    const { run, schedule, repositories, ledger } = setup();
    ledger.balances.set('account-a', Money.of(100n));
    schedule();

    await expect(run.runOnce()).resolves.toBe(1);

    expect(ledger.posted).toEqual([]);
    expect(repositories.transfers[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
    });
    expect(repositories.occurrences).toHaveLength(1);
    expect(repositories.schedules[0]).toMatchObject({ status: 'ACTIVE', nextSequence: 2 });
    expect(repositories.auditEvents[0]).toMatchObject({
      action: 'PIX_FAILED',
      metadata: { scheduleId: 'schedule-1', sequence: 1, reason: 'INSUFFICIENT_FUNDS' },
    });
  });

  it.each([
    ['account-a', 'ACCOUNT_BLOCKED'],
    ['account-b', 'PAYEE_UNAVAILABLE'],
  ])('fails an occurrence when %s is blocked on the day (S1)', async (blocked, reason) => {
    const { run, schedule, repositories, accounts } = setup();
    const account = accounts.accounts.get(blocked);
    if (account) accounts.accounts.set(blocked, { ...account, status: 'BLOCKED' });
    schedule();

    await run.runOnce();

    expect(repositories.transfers[0]).toMatchObject({ status: 'FAILED', failureReason: reason });
  });

  it('finishes the schedule with its last occurrence', async () => {
    const { run, schedule, repositories } = setup();
    schedule({ recurrence: { frequency: 'ONCE' } });

    await run.runOnce();

    expect(repositories.schedules[0]).toMatchObject({
      status: 'FINISHED',
      nextSequence: null,
      nextOccurrenceDate: null,
    });
  });

  it('pays nothing before the date', async () => {
    const { run, schedule, repositories } = setup(noonOf('2026-11-04'));
    schedule();

    await expect(run.runOnce()).resolves.toBe(0);
    expect(repositories.transfers).toEqual([]);
  });

  // S3: from 06:00 to 20:00 in São Paulo, so the daytime limit holds.
  it.each(['2026-11-05T05:59:00-03:00', '2026-11-05T20:00:00-03:00'])(
    'pays nothing at night (%s), and opens no transaction',
    async (instant) => {
      const { run, schedule, repositories, unitOfWork } = setup(new Date(instant));
      schedule();

      await expect(run.runOnce()).resolves.toBe(0);
      expect(repositories.transfers).toEqual([]);
      expect(unitOfWork.runs).toBe(0);
    },
  );

  // S4: late, but once per schedule per round, and never two dates at once.
  it('pays an occurrence that did not run on its day, one per round', async () => {
    const { run, schedule, repositories } = setup(noonOf('2027-01-10'));
    schedule();

    await expect(run.runOnce()).resolves.toBe(1);
    expect(repositories.occurrences.map((o) => o.occurrenceDate)).toEqual(['2026-11-05']);

    await expect(run.runOnce()).resolves.toBe(1);
    expect(repositories.occurrences.map((o) => o.occurrenceDate)).toEqual([
      '2026-11-05',
      '2026-12-05',
    ]);
  });

  it('pays every schedule due, each in a transaction of its own', async () => {
    const { run, schedule, repositories, unitOfWork } = setup();
    schedule();
    schedule({ amount: Money.of(2_000n) });

    await expect(run.runOnce()).resolves.toBe(2);

    expect(repositories.occurrences.map((o) => o.scheduleId)).toEqual(['schedule-1', 'schedule-2']);
    expect(unitOfWork.runs).toBe(3);
  });

  it('pays at most 20 occurrences per round', async () => {
    const { run, schedule, ledger } = setup();
    ledger.balances.set('account-a', Money.of(10_000_000n));
    for (let i = 0; i < 21; i += 1) schedule({ amount: Money.of(100n) });

    await expect(run.runOnce()).resolves.toBe(20);
    await expect(run.runOnce()).resolves.toBe(1);
  });

  it('never pays a cancelled schedule (EXT-06)', async () => {
    const { run, schedule, repositories } = setup();
    schedule();
    const [state] = repositories.schedules;
    if (state) {
      const cancelled = PixSchedule.restore(state);
      cancelled.cancel(SCHEDULED_AT);
      repositories.schedules[0] = { ...cancelled.state };
    }

    await expect(run.runOnce()).resolves.toBe(0);
    expect(repositories.transfers).toEqual([]);
  });

  it('goes on past an occurrence that fails for a technical reason, then says so', async () => {
    const world = setup();
    world.accounts.accounts.set('account-c', {
      id: 'account-c',
      holderUserId: 'user-c',
      status: 'ACTIVE',
    });
    world.identity.people.set('user-c', { name: 'Rui Prado', documentMasked: '***.111.222-**' });
    world.ledger.balances.set('account-c', Money.of(100_000n));
    world.ledger.failingPayer = 'account-a';
    world.schedule();
    world.schedule({ payerAccountId: 'account-c' });

    await expect(world.run.runOnce()).rejects.toThrow('Connection terminated');

    // The other schedule was paid; the failed one is left for the next round.
    expect(world.repositories.lockedDue).toEqual(['schedule-1', 'schedule-2']);
    expect(world.ledger.posted.map((p) => p.payerAccountId)).toEqual(['account-c']);
  });
});
