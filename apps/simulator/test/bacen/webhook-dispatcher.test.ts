import { createHmac, randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { type FaultProfile, Faults, NO_FAULTS, seededRandom } from '../../src/base/faults.ts';
import { type Send, WebhookDispatcher } from '../../src/base/webhook-dispatcher.ts';
import { testPool } from '../helpers.ts';
import { paymentRequest, simulatorFor, withKey } from '../support.ts';

// The SPI answers a payment by a signed webhook (v1.2.0 plan, task 1): the
// payment is settled or rejected when its webhook is due, and the webhook is
// delivered once, lost, or duplicated with the same event id (D5); a
// participant that does not answer gets it again later.
const pool = testPool();
const secret = randomBytes(32);
const webhookUrl = 'http://participant.test/v1/spi/webhooks';
const app = simulatorFor(pool);

afterAll(async () => {
  await app.close();
  await pool.end();
});

interface Sent {
  url: string;
  body: Record<string, unknown>;
  raw: string;
  signature: string;
}

function receiver(answer = true): { send: Send; sent: Sent[] } {
  const sent: Sent[] = [];
  return {
    sent,
    send: (url, body, headers) => {
      sent.push({
        url,
        raw: body,
        body: JSON.parse(body) as Record<string, unknown>,
        signature: headers['x-simulator-signature'] ?? '',
      });
      return Promise.resolve(answer);
    },
  };
}

function dispatcher(
  send: Send,
  profile: Partial<FaultProfile> = {},
  now = () => new Date(Date.now() + 60_000),
) {
  return new WebhookDispatcher({
    pool,
    faults: new Faults({ ...NO_FAULTS, ...profile }, seededRandom(2)),
    clock: now,
    webhook: { url: webhookUrl, secret },
    send,
  });
}

async function take(changes: Record<string, unknown> = {}) {
  const body = paymentRequest(changes);
  const response = await app.inject({
    method: 'POST',
    url: '/spi/payments',
    headers: withKey,
    payload: body,
  });
  expect(response.statusCode).toBe(202);
  return body.endToEndId;
}

async function statusOf(endToEndId: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/spi/payments/${endToEndId}`,
    headers: withKey,
  });
  return response.json<Record<string, unknown>>();
}

const eventsOf = (sent: Sent[], endToEndId: string) =>
  sent.filter((s) => s.body.endToEndId === endToEndId);

describe('WebhookDispatcher', () => {
  it('settles a payment to a known key and sends its signed webhook', async () => {
    const id = await take();
    const { send, sent } = receiver();

    await dispatcher(send).dispatchDue();

    const [event] = eventsOf(sent, id);
    expect(event?.url).toBe(webhookUrl);
    expect(event?.body).toMatchObject({ endToEndId: id, status: 'SETTLED', version: 1 });
    expect(typeof event?.body.eventId).toBe('string');
    const [t, v1] = (event?.signature ?? '').split(',');
    const timestamp = t?.replace('t=', '') ?? '';
    const mac = createHmac('sha256', secret)
      .update(`${timestamp}.${event?.raw ?? ''}`)
      .digest('hex');
    expect(v1).toBe(`v1=${mac}`);
    expect(await statusOf(id)).toMatchObject({ status: 'SETTLED' });
  });

  it('rejects a payment to a key no bank holds', async () => {
    const id = await take({ payeeKey: 'nobody@example.com' });
    const { send, sent } = receiver();

    await dispatcher(send).dispatchDue();

    expect(eventsOf(sent, id)[0]?.body).toMatchObject({
      status: 'REJECTED',
      reason: 'PAYEE_KEY_NOT_FOUND',
    });
  });

  it("rejects a payment when the payee's bank is made to", async () => {
    const id = await take();
    const { send, sent } = receiver();

    await dispatcher(send, { rejectRate: 1 }).dispatchDue();

    expect(eventsOf(sent, id)[0]?.body).toMatchObject({
      status: 'REJECTED',
      reason: 'PAYEE_BANK_REJECTED',
    });
  });

  // EXT-03: a lost webhook still leaves the payment settled, for the status
  // query to find.
  it('loses a webhook when asked, the payment settled all the same', async () => {
    const id = await take();
    const { send, sent } = receiver();

    await dispatcher(send, { webhookLossRate: 1 }).dispatchDue();

    expect(eventsOf(sent, id)).toEqual([]);
    expect(await statusOf(id)).toMatchObject({ status: 'SETTLED' });
  });

  // EXT-02: a duplicated webhook repeats the same event id.
  it('duplicates a webhook with the same event id when asked', async () => {
    const id = await take();
    const { send, sent } = receiver();

    await dispatcher(send, { webhookDuplicateRate: 1 }).dispatchDue();

    const events = eventsOf(sent, id);
    expect(events).toHaveLength(2);
    expect(events[0]?.body.eventId).toBe(events[1]?.body.eventId);
  });

  it('sends nothing before the webhook is due', async () => {
    const id = await take();
    const { send, sent } = receiver();

    await dispatcher(send, {}, () => new Date(Date.now() - 60_000)).dispatchDue();

    expect(eventsOf(sent, id)).toEqual([]);
    expect(await statusOf(id)).toMatchObject({ status: 'PENDING' });
  });

  it('sends the webhook again later when the participant does not answer', async () => {
    const id = await take();
    const down = receiver(false);
    const up = receiver(true);
    const later = () => new Date(Date.now() + 10 * 60_000);

    await dispatcher(down.send).dispatchDue();
    await dispatcher(up.send, {}, later).dispatchDue();

    expect(eventsOf(down.sent, id)).toHaveLength(1);
    expect(eventsOf(up.sent, id)).toHaveLength(1);
    expect(eventsOf(up.sent, id)[0]?.body.eventId).toBe(eventsOf(down.sent, id)[0]?.body.eventId);
  });

  it('sends each webhook once when two dispatchers run at once', async () => {
    const ids = await Promise.all(Array.from({ length: 5 }, () => take()));
    const { send, sent } = receiver();

    await Promise.all([dispatcher(send).dispatchDue(), dispatcher(send).dispatchDue()]);

    for (const id of ids) expect(eventsOf(sent, id)).toHaveLength(1);
  });
});
