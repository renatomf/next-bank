import { randomBytes, randomUUID } from 'node:crypto';
import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Faults, NO_FAULTS, seededRandom } from '../../src/base/faults.ts';
import { type Send, WebhookDispatcher } from '../../src/base/webhook-dispatcher.ts';
import { testPool } from '../helpers.ts';
import { AURORA_KEY, NEXT_BANK_ISPB, newEndToEndId } from '../support.ts';

// The webhook goes out in the trace of the payment it answers (v1.2.0 plan,
// task 8): with the traceparent the payment came in with, beside the
// signature; a payment that came with none sends none.
const pool = testPool();
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

beforeAll(() => {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});
afterAll(async () => {
  propagation.disable();
  await pool.end();
});

/** A payment taken with [traceParent], its webhook due now. */
async function paymentWith(traceParent: string | null): Promise<string> {
  const endToEndId = newEndToEndId();
  await pool.query(
    `INSERT INTO simulator.payments
       (end_to_end_id, request_hash, amount, currency, payer_ispb, payer_name,
        payer_document_masked, payee_key, payee_ispb, status, trace_parent)
     VALUES ($1, 'hash', 1000, 'BRL', $2, 'Ana Demo', '***.444.777-**', $3, '99900001',
             'PENDING', $4)`,
    [endToEndId, NEXT_BANK_ISPB, AURORA_KEY, traceParent],
  );
  await pool.query(
    `INSERT INTO simulator.webhook_deliveries (id, event_id, end_to_end_id, status, due_at)
     VALUES ($1, $2, $3, 'PENDING', now() - interval '1 second')`,
    [randomUUID(), randomUUID(), endToEndId],
  );
  return endToEndId;
}

/** Dispatches what is due and answers the headers each payment's webhook went with. */
async function dispatched(): Promise<Map<string, Record<string, string>>> {
  const headersOf = new Map<string, Record<string, string>>();
  const send: Send = (_url, body, headers) => {
    headersOf.set((JSON.parse(body) as { endToEndId: string }).endToEndId, headers);
    return Promise.resolve(true);
  };
  await new WebhookDispatcher({
    pool,
    faults: new Faults(NO_FAULTS, seededRandom(1)),
    clock: () => new Date(Date.now() + 60_000),
    webhook: { url: 'http://participant.test/v1/spi/webhooks', secret: randomBytes(32) },
    send,
  }).dispatchDue(100);
  return headersOf;
}

describe('the webhook in the trace of its payment', () => {
  it('goes with a traceparent of the trace the payment came in', async () => {
    const id = await paymentWith(`00-${TRACE_ID}-00f067aa0ba902b7-01`);

    const traceparent = (await dispatched()).get(id)?.traceparent;

    expect(traceparent).toMatch(new RegExp(`^00-${TRACE_ID}-[0-9a-f]{16}-[0-9a-f]{2}$`));
  });

  it('goes with no traceparent when the payment came with none', async () => {
    const id = await paymentWith(null);

    const headers = (await dispatched()).get(id);

    expect(headers).toBeDefined();
    expect(headers).not.toHaveProperty('traceparent');
  });
});
