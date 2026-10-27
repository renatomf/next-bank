import { describe, expect, it } from 'vitest';
import { CancelPixSchedule } from '../../../../src/modules/payments/application/cancel-pix-schedule.ts';
import { GetPixSchedules } from '../../../../src/modules/payments/application/get-pix-schedules.ts';
import { ScheduleNotActive } from '../../../../src/modules/payments/domain/errors.ts';
import { PixSchedule } from '../../../../src/modules/payments/domain/pix-schedule.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeUnitOfWork, twoCustomers } from './fakes.ts';

// Seeing and cancelling the scheduled Pix (v1.2.0 plan, task 7): only the
// payer ever reaches a schedule; anyone else gets NotFound (READ-01, EXT-06).
// Cancelling only turns off what was authorized (S6).
const CREATED = new Date('2026-10-27T15:00:00.000Z');
const LATER = new Date('2026-10-28T15:00:00.000Z');

function setup() {
  const world = twoCustomers();
  world.accounts.accounts.set('account-c', {
    id: 'account-c',
    holderUserId: 'user-c',
    status: 'ACTIVE',
  });
  const add = (id: string, createdAt: Date, payerAccountId = 'account-a') => {
    const { state } = PixSchedule.create({
      id,
      payerAccountId,
      payee: {
        accountId: 'account-b',
        name: 'Marina Costa',
        documentMasked: '***.456.789-**',
        keyType: 'CPF',
        keyMasked: '***.456.789-**',
      },
      amount: Money.of(15_000n),
      description: null,
      firstDate: '2026-11-05',
      recurrence: { frequency: 'MONTHLY', times: 3 },
      now: createdAt,
    });
    world.repositories.schedules.push(state);
  };
  add('schedule-1', CREATED);
  const deps = {
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    accounts: world.accounts,
    clock: new FixedClock(LATER),
    ids: new SequentialIds(),
  };
  return {
    ...world,
    add,
    get: new GetPixSchedules(deps),
    cancel: new CancelPixSchedule(deps),
  };
}

describe('GetPixSchedules.list', () => {
  it("lists the payer's schedules, newest first, with no one else's", async () => {
    const { get, add } = setup();
    add('schedule-2', LATER);
    add('schedule-3', LATER, 'account-c');

    const page = await get.list({ userId: 'user-a', after: null });

    expect(page.items.map((item) => item.id)).toEqual(['schedule-2', 'schedule-1']);
    expect(page.next).toBeNull();
  });

  it('pages by 20, with where the page ends', async () => {
    const { get, add } = setup();
    for (let i = 2; i <= 21; i += 1) {
      add(`schedule-${String(i).padStart(2, '0')}`, new Date(CREATED.getTime() + i * 1_000));
    }

    const first = await get.list({ userId: 'user-a', after: null });
    const second = await get.list({ userId: 'user-a', after: first.next });

    expect(first.items).toHaveLength(20);
    expect(first.next).toEqual({
      createdAt: new Date(CREATED.getTime() + 2_000),
      id: 'schedule-02',
    });
    expect(second.items.map((item) => item.id)).toEqual(['schedule-1']);
    expect(second.next).toBeNull();
  });
});

describe('GetPixSchedules.get', () => {
  it('shows the schedule with what each occurrence became', async () => {
    const { get, repositories } = setup();
    repositories.transfers.push({
      id: 'pix-1',
      endToEndId: null,
      payerAccountId: 'account-a',
      payee: {
        accountId: 'account-b',
        name: 'Marina Costa',
        documentMasked: '***.456.789-**',
        keyType: 'CPF',
        keyMasked: '***.456.789-**',
      },
      amount: Money.of(15_000n),
      description: null,
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
      version: 2,
      createdAt: LATER,
      expiresAt: LATER,
      authorizedAt: LATER,
      completedAt: null,
      updatedAt: LATER,
    });
    repositories.occurrences.push({
      id: 'occurrence-1',
      scheduleId: 'schedule-1',
      sequence: 1,
      occurrenceDate: '2026-11-05',
      transferId: 'pix-1',
      executedAt: LATER,
    });

    const detail = await get.get({ userId: 'user-a', scheduleId: 'schedule-1' });

    expect(detail).toMatchObject({ id: 'schedule-1', status: 'ACTIVE' });
    expect(detail.occurrences).toEqual([
      {
        sequence: 1,
        date: '2026-11-05',
        transferId: 'pix-1',
        status: 'FAILED',
        failureReason: 'INSUFFICIENT_FUNDS',
      },
    ]);
  });

  it("finds nothing of another customer's schedule (READ-01)", async () => {
    const { get } = setup();

    await expect(get.get({ userId: 'user-c', scheduleId: 'schedule-1' })).rejects.toThrow(NotFound);
    await expect(get.get({ userId: 'user-a', scheduleId: 'nope' })).rejects.toThrow(NotFound);
  });
});

describe('CancelPixSchedule', () => {
  it('cancels the schedule and records who did it (PIX-09)', async () => {
    const { cancel, repositories } = setup();

    const view = await cancel.execute({
      userId: 'user-a',
      sessionId: 'session-a',
      scheduleId: 'schedule-1',
      requestId: 'req-9',
    });

    expect(view).toMatchObject({
      status: 'CANCELLED',
      nextOccurrenceDate: null,
      cancelledAt: LATER.toISOString(),
    });
    expect(repositories.schedules[0]?.status).toBe('CANCELLED');
    expect(repositories.auditEvents).toEqual([
      {
        id: 'id-1',
        occurredAt: LATER,
        actorType: 'USER',
        actorId: 'user-a',
        action: 'PIX_SCHEDULE_CANCELLED',
        subjectType: 'PIX_SCHEDULE',
        subjectId: 'schedule-1',
        requestId: 'req-9',
        metadata: { sessionId: 'session-a' },
      },
    ]);
  });

  // S6: a lost answer, sent again, is no error.
  it('answers a repeated cancel with the schedule, changing nothing', async () => {
    const { cancel, repositories } = setup();
    const request = { userId: 'user-a', sessionId: 's', scheduleId: 'schedule-1', requestId: null };
    const first = await cancel.execute(request);

    await expect(cancel.execute(request)).resolves.toEqual(first);
    expect(repositories.auditEvents).toHaveLength(1);
  });

  it('refuses a finished schedule', async () => {
    const { cancel, repositories } = setup();
    const [state] = repositories.schedules;
    if (state) {
      const schedule = PixSchedule.restore(state);
      for (let n = 1; n <= 3; n += 1) schedule.advance(n, LATER);
      repositories.schedules[0] = { ...schedule.state };
    }

    await expect(
      cancel.execute({
        userId: 'user-a',
        sessionId: 's',
        scheduleId: 'schedule-1',
        requestId: null,
      }),
    ).rejects.toThrow(ScheduleNotActive);
  });

  it("cannot cancel another customer's schedule (EXT-06)", async () => {
    const { cancel, repositories } = setup();

    await expect(
      cancel.execute({
        userId: 'user-c',
        sessionId: 's',
        scheduleId: 'schedule-1',
        requestId: null,
      }),
    ).rejects.toThrow(NotFound);
    expect(repositories.schedules[0]?.status).toBe('ACTIVE');
  });
});
