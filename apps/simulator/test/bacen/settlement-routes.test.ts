import { afterAll, describe, expect, it } from 'vitest';
import { Faults, NO_FAULTS, seededRandom } from '../../src/base/faults.ts';
import { WebhookDispatcher } from '../../src/base/webhook-dispatcher.ts';
import { testPool } from '../helpers.ts';
import { paymentRequest, simulatorFor, withKey } from '../support.ts';

// The day's settlement file (v1.2.0 plan, task 1): the payments the SPI
// settled in a day of São Paulo, which the API's reconciliation will read
// (task 6). Pending and rejected payments are not in it.
const pool = testPool();
const app = simulatorFor(pool);

afterAll(async () => {
  await app.close();
  await pool.end();
});

/** Takes a payment and settles it (or rejects it) at [at]. */
async function settled(at: Date, changes: Record<string, unknown> = {}) {
  const body = paymentRequest(changes);
  await app.inject({ method: 'POST', url: '/spi/payments', headers: withKey, payload: body });
  await new WebhookDispatcher({
    pool,
    faults: new Faults(NO_FAULTS, seededRandom(4)),
    clock: () => at,
    webhook: { url: 'http://participant.test', secret: Buffer.from('s'.repeat(32)) },
    send: () => Promise.resolve(true),
  }).dispatchDue();
  return body.endToEndId;
}

function settlementOf(date: string) {
  return app.inject({ method: 'GET', url: `/settlements/${date}`, headers: withKey });
}

describe('GET /settlements/:date', () => {
  it('lists the payments settled in that day of São Paulo, and only those', async () => {
    // 23:30 in São Paulo on the 30th is already the 31st in UTC.
    const lateOn30th = await settled(new Date('2026-12-31T02:30:00Z'));
    const on31st = await settled(new Date('2026-12-31T12:00:00Z'));
    const rejected = await settled(new Date('2026-12-31T12:00:00Z'), {
      payeeKey: 'nobody@example.com',
    });

    const response = await settlementOf('2026-12-31');

    expect(response.statusCode).toBe(200);
    const ids = response
      .json<{ payments: { endToEndId: string }[] }>()
      .payments.map((p) => p.endToEndId);
    expect(ids).toContain(on31st);
    expect(ids).not.toContain(lateOn30th);
    expect(ids).not.toContain(rejected);
    expect(
      (await settlementOf('2026-12-30'))
        .json<{ payments: { endToEndId: string }[] }>()
        .payments.map((p) => p.endToEndId),
    ).toContain(lateOn30th);
  });

  it('gives each payment with its amount, banks and time', async () => {
    const id = await settled(new Date('2027-01-05T15:00:00Z'));

    const payment = (await settlementOf('2027-01-05'))
      .json<{ payments: Record<string, unknown>[] }>()
      .payments.find((p) => p.endToEndId === id);

    expect(payment).toEqual({
      endToEndId: id,
      amount: { amount: 1000, currency: 'BRL' },
      payerIspb: '00099999',
      payeeIspb: '99900001',
      settledAt: '2027-01-05T15:00:00.000Z',
    });
  });

  it('refuses a date that is not one', async () => {
    expect((await settlementOf('2026-02-30')).statusCode).toBe(422);
    expect((await settlementOf('yesterday')).statusCode).toBe(422);
  });
});
