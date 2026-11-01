import { randomUUID } from 'node:crypto';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { afterAll, describe, expect, it } from 'vitest';
import type { OutboxHandler } from '../../../src/shared/application/outbox.ts';
import { createPool } from '../../../src/shared/db.ts';
import { OutboxWorker } from '../../../src/shared/infrastructure/outbox-worker.ts';
import { PgOutbox } from '../../../src/shared/infrastructure/pg-outbox.ts';
import { PgUnitOfWork } from '../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../helpers.ts';
import { isChildOf, recordSpans } from '../../tracing.ts';

// The outbox carries the trace across the wait (v1.2.0 plan, task 8, T3): the
// message keeps the `traceparent` of the transaction that wrote it, and the
// worker delivers it, seconds later and in another round, as a child of it.
const { spans, traceOf } = recordSpans();
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);

afterAll(async () => {
  await pool.end();
});

const newType = () => `test.t${randomUUID().slice(0, 8)}`;

function enqueueIn(type: string): Promise<void> {
  const outbox = new PgOutbox({
    ids: new UuidV7Generator(),
    clock: () => new Date(),
    types: new Set([type]),
  });
  return unitOfWork.run((tx) =>
    outbox.enqueue(tx, { type, payload: { id: 'a' }, requestId: 'req-1' }),
  );
}

/** Runs [work] as a request would: inside a span of its own. */
function inRequest(work: () => Promise<void>): Promise<void> {
  return trace.getTracer('test').startActiveSpan('POST /test', async (span) => {
    await work();
    span.end();
  });
}

function deliver(type: string, handler: OutboxHandler): Promise<number> {
  return new OutboxWorker({
    pool,
    clock: () => new Date(),
    handlers: new Map([[type, handler]]),
    errorReporter: { report: () => undefined },
  }).runOnce();
}

async function traceParentOf(type: string): Promise<string | null | undefined> {
  const { rows } = await pool.query<{ trace_parent: string | null }>(
    'SELECT trace_parent FROM platform.outbox_messages WHERE type = $1',
    [type],
  );
  return rows[0]?.trace_parent;
}

const named = (name: string) => spans().find((span) => span.name === name);

describe('the trace through the outbox', () => {
  it('gives each transaction a span, inside the request that runs it', async () => {
    await inRequest(() => enqueueIn(newType()));

    expect(isChildOf(named('transaction'), named('POST /test'))).toBe(true);
  });

  it('keeps the traceparent of the transaction that wrote the message', async () => {
    const type = newType();

    await inRequest(() => enqueueIn(type));

    const transaction = named('transaction')?.spanContext();
    expect(await traceParentOf(type)).toBe(
      `00-${String(transaction?.traceId)}-${String(transaction?.spanId)}-01`,
    );
  });

  it('delivers the message as a child of the transaction, with the handler inside', async () => {
    const type = newType();
    await inRequest(() => enqueueIn(type));
    let activeInHandler: string | undefined;

    await deliver(type, () => {
      activeInHandler = trace.getActiveSpan()?.spanContext().spanId;
      return Promise.resolve();
    });

    const delivery = named(`outbox ${type}`);
    expect(isChildOf(delivery, named('transaction'))).toBe(true);
    expect(activeInHandler).toBe(delivery?.spanContext().spanId);
    expect(delivery?.attributes).toEqual({
      'messaging.message.id': expect.any(String) as string,
      'nextbank.outbox.type': type,
      'nextbank.outbox.attempt': 1,
    });
    expect(traceOf(delivery).map((span) => span.name)).toContain('POST /test');
  });

  it('delivers a message written without a trace in a trace of its own', async () => {
    const type = newType();
    await pool.query(
      `INSERT INTO platform.outbox_messages (id, type, payload, request_id, status, available_at)
       VALUES ($1, $2, '{"id":"a"}', NULL, 'PENDING', $3)`,
      [randomUUID(), type, new Date(Date.now() - 1_000)],
    );

    expect(await deliver(type, () => Promise.resolve())).toBe(1);

    expect(named(`outbox ${type}`)?.parentSpanContext).toBeUndefined();
  });

  it('marks a failed delivery with the name of the error only', async () => {
    const type = newType();
    await inRequest(() => enqueueIn(type));

    await deliver(type, () => Promise.reject(new TypeError('no key clara.aurora@example.com')));

    const delivery = named(`outbox ${type}`);
    expect(delivery?.status).toEqual({ code: SpanStatusCode.ERROR });
    expect(delivery?.attributes['error.type']).toBe('TypeError');
    expect(JSON.stringify(delivery?.attributes)).not.toContain('clara');
  });
});
