import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import { HttpSpiClient, PgExternalPixReader } from '../../../../src/modules/payments/index.ts';
import { createReconciliationModule } from '../../../../src/modules/reconciliation/index.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import {
  AURORA_KEY,
  participantKey,
  type RunningSimulator,
  startSimulator,
} from '../../../simulator.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { pgPixStack } from '../../payments/infrastructure/pg-pix-stack.ts';

// The daily reconciliation against the real Postgres and the real simulator
// (v1.2.0 plan, task 6; EXT-04). The test database is shared, so each case
// keeps to a day of its own and checks the exceptions of the Pix it made;
// the global reads (the Pix waiting, the clearing balance) are checked by
// how much one Pix moves them.
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);
const clock = new FixedClock(new Date('2025-02-01T15:00:00.000Z'));
const AURORA = { type: 'EMAIL' as const, value: AURORA_KEY };
let simulator: RunningSimulator;
let spi: HttpSpiClient;
let pix: ReturnType<typeof pgPixStack>;
const alarms: [string, Partial<Record<string, number>>][] = [];
const reader = new PgExternalPixReader();
const ledger = createLedgerModule({ clock, ids: new UuidV7Generator() });

beforeAll(async () => {
  simulator = await startSimulator();
  spi = new HttpSpiClient({ baseUrl: simulator.url, participantKey, timeoutMs: 2_000 });
  pix = pgPixStack(pool, clock, { spi });
});

afterAll(async () => {
  await simulator.close();
  await pool.end();
});

function reconciliation() {
  return createReconciliationModule({
    unitOfWork,
    clock,
    ids: new UuidV7Generator(),
    files: { fileOf: (date) => spi.settlementFile(date) },
    pix: reader,
    clearing: { of: (tx) => ledger.customerAccounts.systemBalance(tx, 'system:pix_clearing') },
    alarm: { raise: (date, counts) => alarms.push([date, counts]) },
  }).reconcileDay;
}

/** A Pix to the made-up Banco Aurora, authorized and sent to the SPI at [at]. */
async function sentAt(at: string, cents = 5_000): Promise<{ id: string; endToEndId: string }> {
  clock.current = new Date(at);
  const payer = await pix.newCustomer();
  const id = await pix.createToKey(payer, AURORA, cents);
  await pix.authorize(payer, id);
  await pix.deliverOutbox();
  const { rows } = await pool.query<{ end_to_end_id: string }>(
    'SELECT end_to_end_id FROM payments.pix_transfers WHERE id = $1',
    [id],
  );
  return { id, endToEndId: rows[0]?.end_to_end_id ?? '' };
}

/** The SPI settles the payment at [at], as its dispatcher would. */
async function settleAtSpi(endToEndId: string, at: string): Promise<void> {
  await simulator.pool.query(
    `UPDATE simulator.payments SET status = 'SETTLED', decided_at = $2, settled_at = $2
     WHERE end_to_end_id = $1`,
    [endToEndId, new Date(at)],
  );
}

/** next bank takes the SPI's settlement at [at]. */
async function completeHere(endToEndId: string, at: string): Promise<void> {
  clock.current = new Date(at);
  await pix.applySpiOutcome({ eventId: null, endToEndId, status: 'SETTLED' });
}

async function exceptionsOf(runDate: string, endToEndIds: string[]) {
  const { rows } = await pool.query<{ kind: string; end_to_end_id: string }>(
    `SELECT kind, end_to_end_id FROM reconciliation.exceptions
     WHERE run_date = $1 AND end_to_end_id = ANY($2) ORDER BY kind`,
    [runDate, endToEndIds],
  );
  return rows.map((row) => ({ kind: row.kind, endToEndId: row.end_to_end_id }));
}

describe('the daily reconciliation on Postgres and the simulator', () => {
  it('records what differs on a day, and nothing for what agrees (EXT-04)', async () => {
    // Agrees: settled by the SPI and completed here on the day.
    const agrees = await sentAt('2025-02-20T15:00:00.000Z');
    await settleAtSpi(agrees.endToEndId, '2025-02-20T15:01:00.000Z');
    await completeHere(agrees.endToEndId, '2025-02-20T15:02:00.000Z');
    // Completed here, though the SPI never settled it.
    const onlyHere = await sentAt('2025-02-20T16:00:00.000Z');
    await completeHere(onlyHere.endToEndId, '2025-02-20T16:02:00.000Z');
    // Settled by the SPI, though next bank never sent it.
    const onlyAtSpi = `E00000000202502201700${randomUUID().replace(/-/g, '').slice(0, 11)}`;
    await simulator.pool.query(
      `INSERT INTO simulator.payments
         (end_to_end_id, request_hash, amount, currency, payer_ispb, payer_name,
          payer_document_masked, payee_key, payee_ispb, status, decided_at, settled_at)
       VALUES ($1, 'injected', 1000, 'BRL', '00000000', 'Ana Demo', '***.444.777-**',
               $2, '99900001', 'SETTLED', $3, $3)`,
      [onlyAtSpi, AURORA_KEY, new Date('2025-02-20T17:00:00.000Z')],
    );
    clock.current = new Date('2025-02-21T06:30:00.000Z');

    await expect(reconciliation().execute('2025-02-20')).resolves.toMatchObject({
      status: 'RECONCILED',
    });

    expect(
      await exceptionsOf('2025-02-20', [agrees.endToEndId, onlyHere.endToEndId, onlyAtSpi]),
    ).toEqual([
      { kind: 'MISSING_AT_SPI', endToEndId: onlyHere.endToEndId },
      { kind: 'MISSING_HERE', endToEndId: onlyAtSpi },
    ]);
    expect(alarms.find(([date]) => date === '2025-02-20')?.[1]).toMatchObject({
      MISSING_AT_SPI: 1,
      MISSING_HERE: 1,
    });
  });

  // R1: next bank completes after the SPI settles, here past midnight.
  it('finds a Pix completed after midnight in the settlement of the day before', async () => {
    const late = await sentAt('2025-02-22T02:58:00.000Z');
    await settleAtSpi(late.endToEndId, '2025-02-22T02:59:00.000Z'); // 23:59 of the 21st
    await completeHere(late.endToEndId, '2025-02-22T03:01:00.000Z'); // 00:01 of the 22nd
    clock.current = new Date('2025-02-23T06:30:00.000Z');

    await reconciliation().execute('2025-02-22');

    expect(await exceptionsOf('2025-02-22', [late.endToEndId])).toEqual([]);
  });

  it('finds a Pix waiting for the SPI for over a day (R2)', async () => {
    const stuck = await sentAt('2025-02-24T15:00:00.000Z');
    clock.current = new Date('2025-02-27T06:30:00.000Z');

    await reconciliation().execute('2025-02-26');

    expect(await exceptionsOf('2025-02-26', [stuck.endToEndId])).toEqual([
      { kind: 'STALE_PROCESSING', endToEndId: stuck.endToEndId },
    ]);
  });

  // domain-model.md §6: both reads move by the Pix that waits.
  it('reads the clearing balance and the Pix waiting, each moved by a Pix sent', async () => {
    const read = () =>
      unitOfWork.run(async (tx) => ({
        clearing: (await ledger.customerAccounts.systemBalance(tx, 'system:pix_clearing')).cents,
        waiting: (await reader.waitingSum(tx)).cents,
      }));
    const before = await read();

    await sentAt('2025-02-28T15:00:00.000Z', 7_300);

    const after = await read();
    expect(after.clearing - before.clearing).toBe(7_300n);
    expect(after.waiting - before.waiting).toBe(7_300n);
  });

  it('reconciles a day once: run again, or twice at once, it records nothing more', async () => {
    const onlyHere = await sentAt('2025-03-02T15:00:00.000Z');
    await completeHere(onlyHere.endToEndId, '2025-03-02T15:02:00.000Z');
    clock.current = new Date('2025-03-03T06:30:00.000Z');

    const results = await Promise.all([
      reconciliation().execute('2025-03-02'),
      reconciliation().execute('2025-03-02'),
    ]);
    const again = await reconciliation().execute('2025-03-02');

    expect(results.map((result) => result.status).sort()).toEqual(['RECONCILED', 'SKIPPED']);
    expect(again).toEqual({ status: 'SKIPPED' });
    expect(await exceptionsOf('2025-03-02', [onlyHere.endToEndId])).toHaveLength(1);
  });

  it('takes again a day a run left behind for over 30 minutes', async () => {
    await pool.query(
      `INSERT INTO reconciliation.runs (run_date, status, started_at)
       VALUES ('2025-03-04', 'RUNNING', $1)`,
      [new Date('2025-03-05T06:00:00.000Z')],
    );
    clock.current = new Date('2025-03-05T06:20:00.000Z');
    await expect(reconciliation().execute('2025-03-04')).resolves.toEqual({ status: 'SKIPPED' });

    clock.current = new Date('2025-03-05T06:31:00.000Z');
    await expect(reconciliation().execute('2025-03-04')).resolves.toMatchObject({
      status: 'RECONCILED',
    });
  });
});
