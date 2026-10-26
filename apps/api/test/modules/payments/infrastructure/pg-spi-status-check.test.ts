import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpSpiClient } from '../../../../src/modules/payments/infrastructure/http-spi-client.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { testDatabaseUrl } from '../../../helpers.ts';
import {
  AURORA_KEY,
  participantKey,
  type RunningSimulator,
  startSimulator,
} from '../../../simulator.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { pgPixStack } from './pg-pix-stack.ts';

// The status check against the real Postgres and the real simulator (v1.2.0
// plan, task 4; EXT-03, W3): a Pix whose webhook was lost still ends, and a
// Pix the SPI never got is sent again, still one payment there. 15:00 UTC is
// 12:00 in São Paulo.
const pool = createPool(testDatabaseUrl());
const clock = new FixedClock(new Date());
let simulator: RunningSimulator;
let pix: ReturnType<typeof pgPixStack>;

beforeAll(async () => {
  // Every webhook is lost: only the status check can end the Pix.
  simulator = await startSimulator({ webhookLossRate: 1 });
  pix = pgPixStack(pool, clock, {
    spi: new HttpSpiClient({ baseUrl: simulator.url, participantKey, timeoutMs: 2_000 }),
  });
});

afterAll(async () => {
  await simulator.close();
  await pool.end();
});

const AURORA = { type: 'EMAIL' as const, value: AURORA_KEY };

async function paymentsAtSpi(endToEndId: string): Promise<number> {
  const { rows } = await simulator.pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM simulator.payments WHERE end_to_end_id = $1',
    [endToEndId],
  );
  return rows[0]?.n ?? 0;
}

async function stateOf(pixId: string) {
  const { rows } = await pool.query<{ status: string; end_to_end_id: string }>(
    'SELECT status, end_to_end_id FROM payments.pix_transfers WHERE id = $1',
    [pixId],
  );
  const row = rows[0];
  if (!row) throw new Error(`no Pix ${pixId}`);
  return row;
}

function later(minutes: number): void {
  clock.current = new Date(clock.current.getTime() + minutes * 60_000);
}

describe('the status check on Postgres and the simulator', () => {
  it('ends a Pix whose webhook was lost (EXT-03)', async () => {
    const payer = await pix.newCustomer();
    const pixId = await pix.createToKey(payer, AURORA, 5_000);
    await pix.authorize(payer, pixId);
    await pix.deliverOutbox();
    // The SPI settles it, and its webhook is lost.
    await simulator.dispatchDue();
    later(3);

    await pix.checkPending();

    expect((await stateOf(pixId)).status).toBe('COMPLETED');
  });

  it('sends again a Pix the SPI never got, still one payment there (W3)', async () => {
    const payer = await pix.newCustomer();
    const pixId = await pix.createToKey(payer, AURORA, 5_000);
    await pix.authorize(payer, pixId);
    const { end_to_end_id: endToEndId } = await stateOf(pixId);
    // The message never reached the SPI: as if every attempt failed.
    await pool.query(
      `UPDATE platform.outbox_messages SET status = 'DEAD'
       WHERE payload->>'transferId' = $1`,
      [pixId],
    );
    later(3);

    await pix.checkPending();
    await pix.deliverOutbox();
    await pix.checkPending();

    expect(await paymentsAtSpi(endToEndId)).toBe(1);
    expect((await stateOf(pixId)).status).toBe('PROCESSING');
  });
});
