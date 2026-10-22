import { afterAll, describe, expect, it } from 'vitest';
import { testPool } from '../helpers.ts';
import { paymentRequest, participantKey, simulatorFor, withKey } from '../support.ts';

// The SPI of the simulated Bacen (v1.2.0 plan, task 1): a payment is taken
// with 202 and answered later by a webhook; the same end-to-end id is one
// payment however often it comes (ADR 0007); its status can always be asked
// (EXT-03); injected faults fail before or after it is taken (D5).
const pool = testPool();
const app = simulatorFor(pool);

afterAll(async () => {
  await app.close();
  await pool.end();
});

function send(body: Record<string, unknown>, simulator = app) {
  return simulator.inject({
    method: 'POST',
    url: '/spi/payments',
    headers: withKey,
    payload: body,
  });
}

async function rowsOf(endToEndId: string) {
  const payments = await pool.query<{ status: string; amount: string }>(
    'SELECT status, amount FROM simulator.payments WHERE end_to_end_id = $1',
    [endToEndId],
  );
  const deliveries = await pool.query<{ status: string }>(
    'SELECT status FROM simulator.webhook_deliveries WHERE end_to_end_id = $1',
    [endToEndId],
  );
  return { payments: payments.rows, deliveries: deliveries.rows };
}

describe('POST /spi/payments', () => {
  it('takes a payment with 202, pending, and owes its webhook', async () => {
    const body = paymentRequest();

    const response = await send(body);

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ endToEndId: body.endToEndId, status: 'PENDING' });
    expect(await rowsOf(body.endToEndId)).toEqual({
      payments: [{ status: 'PENDING', amount: '1000' }],
      deliveries: [{ status: 'PENDING' }],
    });
  });

  it('takes the same end-to-end id once, answering it the same', async () => {
    const body = paymentRequest();

    const first = await send(body);
    const second = await send(body);

    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(first.json());
    expect((await rowsOf(body.endToEndId)).payments).toHaveLength(1);
  });

  it('takes the same end-to-end id once even when it comes 10 times at once', async () => {
    const body = paymentRequest();

    const responses = await Promise.all(Array.from({ length: 10 }, () => send(body)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(202));
    expect(await rowsOf(body.endToEndId)).toEqual({
      payments: [{ status: 'PENDING', amount: '1000' }],
      deliveries: [{ status: 'PENDING' }],
    });
  });

  it('refuses the same end-to-end id with another payment', async () => {
    const body = paymentRequest();
    await send(body);

    const response = await send({ ...body, amount: { amount: 2000, currency: 'BRL' } });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'EndToEndIdReused' });
  });

  it.each([
    ['a malformed end-to-end id', { endToEndId: 'E1' }],
    ['a zero amount', { amount: { amount: 0, currency: 'BRL' } }],
    ['a fractional amount', { amount: { amount: 10.5, currency: 'BRL' } }],
    ['another currency', { amount: { amount: 1000, currency: 'USD' } }],
    ['an unknown field', { extra: true }],
  ])('refuses %s', async (_case, changes) => {
    const body = paymentRequest(changes);

    const response = await send(body);

    expect(response.statusCode).toBe(422);
  });

  it('refuses a call without the participant key (EXT-09)', async () => {
    const body = paymentRequest();

    const response = await app.inject({ method: 'POST', url: '/spi/payments', payload: body });

    expect(response.statusCode).toBe(401);
    expect((await rowsOf(body.endToEndId)).payments).toEqual([]);
  });

  // D5: an error comes before the payment is taken, so the participant may
  // send it again.
  it('takes nothing when an error is injected', async () => {
    const failing = simulatorFor(pool, { profile: { errorRate: 1 } });
    const body = paymentRequest();

    const response = await send(body, failing);
    await failing.close();

    expect(response.statusCode).toBe(503);
    expect((await rowsOf(body.endToEndId)).payments).toEqual([]);
  });

  // EXT-03: a timeout comes after the payment is taken, so the participant
  // must ask its status instead of sending it blind.
  it('takes the payment but never answers when a timeout is injected', async () => {
    const timingOut = simulatorFor(pool, { profile: { timeoutRate: 1 } });
    const address = await timingOut.listen({ port: 0, host: '127.0.0.1' });
    const body = paymentRequest();

    const call = fetch(`${address}/spi/payments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-participant-key': participantKey },
      body: JSON.stringify(body),
    });

    await expect(call).rejects.toThrow();
    await timingOut.close();
    expect((await rowsOf(body.endToEndId)).payments).toEqual([
      { status: 'PENDING', amount: '1000' },
    ]);
  });
});

describe('GET /spi/payments/:endToEndId', () => {
  it('gives the status of a payment taken', async () => {
    const body = paymentRequest();
    await send(body);

    const response = await app.inject({
      method: 'GET',
      url: `/spi/payments/${body.endToEndId}`,
      headers: withKey,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ endToEndId: body.endToEndId, status: 'PENDING' });
  });

  it('answers an end-to-end id never sent as not found', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/spi/payments/${paymentRequest().endToEndId}`,
      headers: withKey,
    });

    expect(response.statusCode).toBe(404);
  });
});
