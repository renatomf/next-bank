import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { participantKey, type RunningSimulator, startSimulator } from './simulator.ts';
import { PARTNER_SPAN_ID, PARTNER_TRACE_ID, PARTNER_TRACEPARENT, recordSpans } from './tracing.ts';

// A span per request (v1.2.0 plan, task 8), named by the route's template,
// never by its path (API-04, READ-06). A `traceparent` from outside is taken
// only from a partner, on the SPI's webhook; a request of the app always
// starts a trace of its own, tied to the app by its request id (EXT-10, T4).
const { spans } = recordSpans();
let simulator: RunningSimulator;
let app: FastifyInstance;

beforeAll(async () => {
  simulator = await startSimulator();
  app = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: simulator.url, participantKey, webhookSecret: randomBytes(32) },
  });
});

afterAll(async () => {
  await app.close();
  await simulator.close();
});

describe('a span per request', () => {
  it('names the span by the route and ties it to the request id', async () => {
    await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'app-request-0001' },
    });

    const [span] = spans();
    expect(span?.name).toBe('GET /health');
    expect(span?.attributes).toEqual({
      'http.request.method': 'GET',
      'http.route': '/health',
      'http.response.status_code': 200,
      'nextbank.request_id': 'app-request-0001',
    });
  });

  it('never puts the path in the span: only the template', async () => {
    const transferId = randomUUID();

    await app.inject({ method: 'GET', url: `/v1/pix/transfers/${transferId}` });

    const [span] = spans();
    expect(span?.name).toBe('GET /v1/pix/transfers/:transferId');
    expect(JSON.stringify([span?.name, span?.attributes])).not.toContain(transferId);
  });

  it('names a request no route takes by its method alone', async () => {
    await app.inject({ method: 'GET', url: '/nowhere/clara.aurora@example.com' });

    const [span] = spans();
    expect(span?.name).toBe('GET');
    expect(JSON.stringify(span?.attributes)).not.toContain('clara');
  });
});

// EXT-10: a client cannot hang its requests on someone else's trace.
describe('the traceparent from outside', () => {
  it('starts a trace of its own on a route of the app, whatever the client sends', async () => {
    await app.inject({
      method: 'GET',
      url: '/health',
      headers: { traceparent: PARTNER_TRACEPARENT },
    });

    const [span] = spans();
    expect(span?.spanContext().traceId).not.toBe(PARTNER_TRACE_ID);
    expect(span?.parentSpanContext).toBeUndefined();
  });

  it('continues the trace of the SPI on its webhook', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/spi/webhooks',
      headers: { 'content-type': 'application/json', traceparent: PARTNER_TRACEPARENT },
      payload: '{}',
    });

    const [span] = spans();
    expect(span?.name).toBe('POST /v1/spi/webhooks');
    expect(span?.spanContext().traceId).toBe(PARTNER_TRACE_ID);
    expect(span?.parentSpanContext?.spanId).toBe(PARTNER_SPAN_ID);
  });

  it.each([
    'not-a-traceparent',
    `00-${'0'.repeat(32)}-${PARTNER_SPAN_ID}-01`,
    `00-${PARTNER_TRACE_ID.toUpperCase()}-${PARTNER_SPAN_ID}-01`,
  ])('ignores the malformed traceparent %s on the webhook', async (traceparent) => {
    await app.inject({
      method: 'POST',
      url: '/v1/spi/webhooks',
      headers: { 'content-type': 'application/json', traceparent },
      payload: '{}',
    });

    const [span] = spans();
    expect(span?.parentSpanContext).toBeUndefined();
  });
});
