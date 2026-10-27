import { describe, expect, it } from 'vitest';
import type {
  ClearingBalance,
  DivergenceAlarm,
  ExternalPixReader,
  ReconciliationRepository,
  ReconciliationRepositoryFactory,
  SettlementFiles,
} from '../../../../src/modules/reconciliation/application/ports.ts';
import { ReconcileDay } from '../../../../src/modules/reconciliation/application/reconcile-day.ts';
import type {
  Divergence,
  PixHere,
  SettledAtSpi,
} from '../../../../src/modules/reconciliation/domain/reconciliation.ts';
import type { Transaction, UnitOfWork } from '../../../../src/shared/application/ports.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock } from '../../identity/application/fakes.ts';

// Reconciling a day (v1.2.0 plan, task 6; EXT-04, R3–R5): the day is reserved
// once, the SPI's files of the day and the day before are read with no
// transaction open, next bank's side is read in one snapshot, and what
// differs is recorded with the run's end, in one transaction. A run with
// divergences raises one alarm with the counts only.
const e2e = (n: number) => `E00000000202610261200${String(n).padStart(11, '0')}`;
const reais = (cents: number) => Money.of(BigInt(cents));
const TX: Transaction = { kind: 'transaction' };
const NOW = new Date('2026-10-27T06:30:00.000Z'); // 03:30 in São Paulo

class FakeUnitOfWork implements UnitOfWork {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return work(TX);
  }
}

/** The runs and exceptions in memory, with the order each step came in. */
class FakeReconciliationStore implements ReconciliationRepositoryFactory {
  readonly runs = new Map<string, { status: 'RUNNING' | 'DONE'; counts?: [number, number] }>();
  readonly recorded: Divergence[] = [];
  readonly steps: string[] = [];

  for(): ReconciliationRepository {
    return {
      reserve: (runDate) => {
        this.steps.push('reserve');
        if (this.runs.has(runDate)) return Promise.resolve(false);
        this.runs.set(runDate, { status: 'RUNNING' });
        return Promise.resolve(true);
      },
      readOneSnapshot: () => {
        this.steps.push('snapshot');
        return Promise.resolve();
      },
      record: (_runDate, divergences) => {
        this.steps.push('record');
        this.recorded.push(...divergences);
        return Promise.resolve();
      },
      finish: (runDate, _now, paymentsChecked, exceptionsFound) => {
        this.steps.push('finish');
        this.runs.set(runDate, { status: 'DONE', counts: [paymentsChecked, exceptionsFound] });
        return Promise.resolve();
      },
    };
  }
}

class FakeSettlementFiles implements SettlementFiles {
  readonly files = new Map<string, SettledAtSpi[]>();
  readonly asked: string[] = [];
  down = false;
  fileOf(date: string): Promise<SettledAtSpi[]> {
    if (this.down) return Promise.reject(new Error('SPI unreachable'));
    this.asked.push(date);
    return Promise.resolve(this.files.get(date) ?? []);
  }
}

class FakeExternalPix implements ExternalPixReader {
  readonly ours = new Map<string, PixHere>();
  completed: string[] = [];
  waiting: string[] = [];
  sum = reais(0);
  readonly asked: { completedBetween?: [Date, Date]; waitingSince?: Date } = {};
  byEndToEndIds(_tx: Transaction, endToEndIds: string[]) {
    return Promise.resolve(
      new Map([...this.ours].filter(([endToEndId]) => endToEndIds.includes(endToEndId))),
    );
  }
  completedBetween(_tx: Transaction, from: Date, to: Date) {
    this.asked.completedBetween = [from, to];
    return Promise.resolve(this.completed);
  }
  waitingSince(_tx: Transaction, authorizedBefore: Date) {
    this.asked.waitingSince = authorizedBefore;
    return Promise.resolve(this.waiting);
  }
  waitingSum() {
    return Promise.resolve(this.sum);
  }
}

function setup() {
  const store = new FakeReconciliationStore();
  const files = new FakeSettlementFiles();
  const pix = new FakeExternalPix();
  let clearing = reais(0);
  const balance: ClearingBalance = { of: () => Promise.resolve(clearing) };
  const alarms: [string, Partial<Record<string, number>>][] = [];
  const alarm: DivergenceAlarm = { raise: (date, counts) => alarms.push([date, counts]) };
  const reconcile = new ReconcileDay({
    unitOfWork: new FakeUnitOfWork(),
    repositories: store,
    files,
    pix,
    clearing: balance,
    alarm,
    clock: new FixedClock(NOW),
  });
  return {
    store,
    files,
    pix,
    alarms,
    reconcile,
    setClearing: (cents: number) => {
      clearing = reais(cents);
    },
  };
}

describe('ReconcileDay', () => {
  it('finishes a day that agrees, with its counts and no alarm', async () => {
    const { store, files, pix, alarms, reconcile } = setup();
    files.files.set('2026-10-26', [{ endToEndId: e2e(1), amount: reais(5_000) }]);
    pix.ours.set(e2e(1), { amount: reais(5_000), status: 'COMPLETED' });
    pix.completed = [e2e(1)];

    await expect(reconcile.execute('2026-10-26')).resolves.toEqual({
      status: 'RECONCILED',
      divergences: 0,
    });

    expect(store.runs.get('2026-10-26')).toEqual({ status: 'DONE', counts: [1, 0] });
    expect(store.recorded).toEqual([]);
    expect(alarms).toEqual([]);
  });

  it('records what differs and raises one alarm with the counts only (R4)', async () => {
    const { store, files, pix, alarms, reconcile, setClearing } = setup();
    files.files.set('2026-10-26', [{ endToEndId: e2e(1), amount: reais(5_000) }]);
    pix.waiting = [e2e(3)];
    setClearing(1);

    await expect(reconcile.execute('2026-10-26')).resolves.toEqual({
      status: 'RECONCILED',
      divergences: 3,
    });

    expect(store.recorded.map((divergence) => divergence.kind)).toEqual([
      'MISSING_HERE',
      'STALE_PROCESSING',
      'CLEARING_MISMATCH',
    ]);
    expect(store.runs.get('2026-10-26')).toEqual({ status: 'DONE', counts: [1, 3] });
    expect(alarms).toEqual([
      ['2026-10-26', { MISSING_HERE: 1, STALE_PROCESSING: 1, CLEARING_MISMATCH: 1 }],
    ]);
  });

  // R1: a Pix completed today may have settled the day before.
  it('reads the files of the day and of the day before', async () => {
    const { files, pix, reconcile } = setup();
    files.files.set('2026-10-25', [{ endToEndId: e2e(2), amount: reais(1_000) }]);
    pix.completed = [e2e(2)];

    await expect(reconcile.execute('2026-10-26')).resolves.toMatchObject({ divergences: 0 });
    expect(files.asked).toEqual(['2026-10-26', '2026-10-25']);
  });

  it("reads next bank's side for the day of São Paulo, and the Pix waiting since the day before", async () => {
    const { pix, reconcile } = setup();

    await reconcile.execute('2026-10-26');

    expect(pix.asked.completedBetween).toEqual([
      new Date('2026-10-26T03:00:00.000Z'),
      new Date('2026-10-27T03:00:00.000Z'),
    ]);
    expect(pix.asked.waitingSince).toEqual(new Date('2026-10-25T03:00:00.000Z'));
  });

  // The clearing balance and the sum of the Pix waiting are one snapshot.
  it("reads next bank's side in one snapshot, then records and finishes", async () => {
    const { store, reconcile } = setup();

    await reconcile.execute('2026-10-26');

    expect(store.steps).toEqual(['reserve', 'snapshot', 'record', 'finish']);
  });

  it('does nothing for a day another run reserved or finished', async () => {
    const { store, files, reconcile } = setup();
    store.runs.set('2026-10-26', { status: 'RUNNING' });

    await expect(reconcile.execute('2026-10-26')).resolves.toEqual({ status: 'SKIPPED' });

    expect(files.asked).toEqual([]);
  });

  // The run stays reserved, and is taken again later; nothing half-written.
  it('fails without recording anything when the SPI does not answer', async () => {
    const { store, files, reconcile } = setup();
    files.down = true;

    await expect(reconcile.execute('2026-10-26')).rejects.toThrow(/unreachable/);

    expect(store.runs.get('2026-10-26')).toEqual({ status: 'RUNNING' });
    expect(store.recorded).toEqual([]);
  });

  // R3: at 03:30 in São Paulo, yesterday is reconciled.
  it('reconciles the day that is due', async () => {
    const { store, reconcile } = setup();

    await reconcile.reconcileDueDay();

    expect([...store.runs.keys()]).toEqual(['2026-10-26']);
  });
});
