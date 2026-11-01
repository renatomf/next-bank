import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-node';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { mountSimulator } from '../src/mount-simulator.ts';
import { createPool } from '../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from './helpers.ts';
import { fictitiousCpf } from './modules/identity/fixtures.ts';
import { externalPixClient } from './modules/payments/http/external-pix-client.ts';
import { AURORA_KEY, participantKey } from './simulator.ts';
import { isChildOf, recordSpans } from './tracing.ts';

// The trace of a Pix to another bank, end to end, as it runs in production
// (v1.2.0 plan, task 8): the authorization, the outbox's delivery seconds
// later, the SPI of the mounted simulator and the webhook it posts back, in
// one trace, with nothing personal in it (EXT-07).
const { spans, traceOf } = recordSpans();
let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A port free now, for a server that must know its own address before it listens. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('no port'));
        else resolve(address.port);
      });
    });
  });
}

async function service() {
  const databaseUrl = process.env.TEST_SIMULATOR_DATABASE_URL;
  if (!databaseUrl) throw new Error('TEST_SIMULATOR_DATABASE_URL is not set (see .env.example)');
  const port = await freePort();
  const base = `http://127.0.0.1:${String(port)}`;
  const webhookSecret = randomBytes(32);
  const server = buildApp({
    pool: createPool(testDatabaseUrl()),
    logStream: captureLogs().stream,
    security: testSecurity(),
    externalPix: { simulatorUrl: `${base}/simulator`, participantKey, webhookSecret },
  });
  app = server;
  const simulator = await mountSimulator(server, {
    databaseUrl,
    participantKey,
    webhookSecret,
    webhookUrl: `${base}/v1/spi/webhooks`,
  });
  await server.listen({ host: '127.0.0.1', port });
  return { server, simulator, client: externalPixClient(server, '198.18.12') };
}

const AUTHORIZE = 'POST /v1/pix/transfers/:transferId/authorize';

/** The one span named [name] among [among], failing on none or more. */
function only(among: readonly ReadableSpan[], name: string): ReadableSpan {
  const [span, ...others] = among.filter((candidate) => candidate.name === name);
  if (!span || others.length > 0) throw new Error(`not one span named ${name}`);
  return span;
}

/** The transaction spans of [among] that hang from [parent]. */
function transactionsUnder(among: readonly ReadableSpan[], parent: ReadableSpan | undefined) {
  return among.filter((span) => span.name === 'transaction' && isChildOf(span, parent));
}

describe('the trace of a Pix to another bank', () => {
  it('follows the Pix from the authorization to the webhook in one trace', async () => {
    const { server, simulator, client } = await service();
    const payer = await client.newCustomer();
    const pix = await client.sendToAurora(payer);

    await server.outboxWorker.runOnce(100);
    await simulator.dispatchDue();

    const authorize = spans().find(
      (span) =>
        span.name === AUTHORIZE &&
        traceOf(span).some((other) => other.attributes['nextbank.pix.transfer_id'] === pix.id),
    );
    const trace = traceOf(authorize);
    const delivery = only(trace, 'outbox pix.send-external');
    const sent = only(trace, 'POST /spi/payments');
    const taken = only(trace, 'POST /simulator/spi/payments');
    const dispatched = only(trace, 'webhook dispatch');
    const webhook = only(trace, 'POST /v1/spi/webhooks');
    const [authorized] = transactionsUnder(trace, authorize);

    expect(authorize?.parentSpanContext).toBeUndefined();
    expect(authorized?.attributes).toMatchObject({
      'nextbank.pix.transfer_id': pix.id,
      'nextbank.pix.status': 'PROCESSING',
    });
    expect(isChildOf(delivery, authorized)).toBe(true);
    expect(isChildOf(sent, delivery)).toBe(true);
    expect(isChildOf(taken, sent)).toBe(true);
    expect(isChildOf(dispatched, taken)).toBe(true);
    expect(isChildOf(webhook, dispatched)).toBe(true);
    expect(transactionsUnder(trace, webhook).map((span) => span.attributes)).toContainEqual(
      expect.objectContaining({
        'nextbank.pix.transfer_id': pix.id,
        'nextbank.pix.end_to_end_id': pix.endToEndId,
        'nextbank.pix.status': 'COMPLETED',
      }),
    );
  });

  it('keeps two Pix sent at the same time in traces of their own', async () => {
    const { server, simulator, client } = await service();
    const [ana, bia] = [await client.newCustomer(), await client.newCustomer()];
    const sent = await Promise.all([client.sendToAurora(ana), client.sendToAurora(bia)]);

    await server.outboxWorker.runOnce(100);
    await simulator.dispatchDue();

    const traces = sent.map(({ id }) => {
      const delivery = spans().find(
        (span) =>
          span.name === 'outbox pix.send-external' &&
          traceOf(span).some((other) => other.attributes['nextbank.pix.transfer_id'] === id),
      );
      return traceOf(delivery);
    });
    for (const [index, trace] of traces.entries()) {
      const ids = new Set(
        trace.map((span) => span.attributes['nextbank.pix.transfer_id']).filter(Boolean),
      );
      expect(ids).toEqual(new Set([sent[index]?.id]));
      expect(trace.filter((span) => span.name === 'POST /v1/spi/webhooks')).toHaveLength(1);
    }
    expect(traces[0]?.[0]?.spanContext().traceId).not.toBe(traces[1]?.[0]?.spanContext().traceId);
  });

  // EXT-07: the Pix's trace leaves nothing personal of the payer or the payee.
  it('carries no CPF, Pix key, name or document', async () => {
    const { server, simulator, client } = await service();
    const cpf = fictitiousCpf();
    const payer = await client.newCustomer(cpf);
    await client.sendToAurora(payer);

    await server.outboxWorker.runOnce(100);
    await simulator.dispatchDue();

    const exported = JSON.stringify(
      spans().map((span) => ({
        name: span.name,
        attributes: span.attributes,
        events: span.events,
        status: span.status,
        links: span.links,
        resource: span.resource.attributes,
      })),
    );
    expect(spans().length).toBeGreaterThan(5);
    for (const personal of [
      cpf,
      `${cpf.slice(3, 6)}.${cpf.slice(6, 9)}`,
      AURORA_KEY,
      encodeURIComponent(AURORA_KEY),
      'Maria Teste',
      'Clara Aurora',
      '***.407.256-**',
    ]) {
      expect(exported).not.toContain(personal);
    }
  });
});
