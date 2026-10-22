import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { DeliveredMessage, OutboxHandler } from '../../../src/shared/application/outbox.ts';
import type { ErrorReporter, ReportedRequest } from '../../../src/shared/application/ports.ts';
import { createPool } from '../../../src/shared/db.ts';
import { OutboxWorker } from '../../../src/shared/infrastructure/outbox-worker.ts';
import { PgOutbox } from '../../../src/shared/infrastructure/pg-outbox.ts';
import { PgUnitOfWork } from '../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../helpers.ts';

// The transactional outbox (v1.2.0 plan, task 2; ADR 0016) against the real
// Postgres: a message is written in the command's own transaction and
// delivered at least once by the worker, which never holds a lock while a
// handler runs (F-40), tries again with growing waits and gives up after
// ten attempts (EXT-08). Each test uses a type of its own, so the workers of
// one test never take another's messages.
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);

afterAll(async () => {
  await pool.end();
});

const newType = () => `test.t${randomUUID().slice(0, 8)}`;

function outboxFor(...types: string[]) {
  return new PgOutbox({
    ids: new UuidV7Generator(),
    clock: () => new Date(),
    types: new Set(types),
  });
}

class RecordingReporter implements ErrorReporter {
  readonly reports: { error: unknown; request: ReportedRequest }[] = [];
  report(error: unknown, request: ReportedRequest): void {
    this.reports.push({ error, request });
  }
}

function workerFor(
  type: string,
  handler: OutboxHandler,
  options: { now?: () => Date; reporter?: ErrorReporter } = {},
) {
  return new OutboxWorker({
    pool,
    clock: options.now ?? (() => new Date()),
    handlers: new Map([[type, handler]]),
    errorReporter: options.reporter ?? new RecordingReporter(),
  });
}

async function enqueue(type: string, payload: Record<string, string | number> = { id: 'a' }) {
  await unitOfWork.run((tx) => outboxFor(type).enqueue(tx, { type, payload, requestId: 'req-1' }));
}

async function messagesOf(type: string) {
  const { rows } = await pool.query<{
    status: string;
    attempts: number;
    last_error: string | null;
    available_at: Date;
  }>(
    'SELECT status, attempts, last_error, available_at FROM platform.outbox_messages WHERE type = $1',
    [type],
  );
  return rows;
}

const later = (ms: number) => () => new Date(Date.now() + ms);

describe('PgOutbox', () => {
  it('writes the message in the transaction of the command', async () => {
    const type = newType();

    await enqueue(type);

    expect(await messagesOf(type)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);
  });

  it('writes nothing when the command is undone', async () => {
    const type = newType();

    await expect(
      unitOfWork.run(async (tx) => {
        await outboxFor(type).enqueue(tx, { type, payload: { id: 'a' }, requestId: null });
        throw new Error('the command failed');
      }),
    ).rejects.toThrow('the command failed');

    expect(await messagesOf(type)).toEqual([]);
  });

  // Found in CI: the database's clock ran ahead of the worker's, so a message
  // stamped with the database's now() was not yet available to a worker
  // running right after. Both read the application's clock.
  it("makes the message available at the time of the application's clock", async () => {
    const type = newType();
    const at = new Date('2026-10-22T12:00:00.000Z');

    await unitOfWork.run((tx) =>
      new PgOutbox({ ids: new UuidV7Generator(), clock: () => at, types: new Set([type]) }).enqueue(
        tx,
        { type, payload: { id: 'a' }, requestId: null },
      ),
    );

    expect((await messagesOf(type))[0]?.available_at).toEqual(at);
  });

  it('refuses a type it does not know', async () => {
    const type = newType();

    await expect(
      unitOfWork.run((tx) =>
        outboxFor('test.other').enqueue(tx, { type, payload: { id: 'a' }, requestId: null }),
      ),
    ).rejects.toThrow(/unknown outbox message type/);
  });
});

describe('OutboxWorker', () => {
  it('hands each message to the handler of its type, then marks it done', async () => {
    const type = newType();
    await enqueue(type, { transferId: 't-1' });
    const seen: DeliveredMessage[] = [];

    await workerFor(type, (message) => {
      seen.push(message);
      return Promise.resolve();
    }).runOnce();

    expect(seen).toMatchObject([{ type, payload: { transferId: 't-1' }, attempts: 0 }]);
    expect(typeof seen[0]?.id).toBe('string');
    expect(await messagesOf(type)).toMatchObject([{ status: 'DONE', attempts: 1 }]);
  });

  it('tries a failed message again later, keeping only the error name', async () => {
    const type = newType();
    await enqueue(type);
    const now = new Date();

    await workerFor(type, () => Promise.reject(new TypeError('secret 123.456.789-09')), {
      now: () => now,
    }).runOnce();

    const [message] = await messagesOf(type);
    expect(message).toMatchObject({ status: 'PENDING', attempts: 1, last_error: 'TypeError' });
    expect(message?.available_at.getTime()).toBe(now.getTime() + 1_000);
  });

  it('leaves a message alone until it is available again', async () => {
    const type = newType();
    await enqueue(type);
    const failing = () => Promise.reject(new Error('down'));
    let calls = 0;
    const counting: OutboxHandler = () => {
      calls++;
      return Promise.resolve();
    };

    await workerFor(type, failing).runOnce();
    await workerFor(type, counting).runOnce();
    await workerFor(type, counting, { now: later(2_000) }).runOnce();

    expect(calls).toBe(1);
  });

  // EXT-08: after the last attempt a person decides; the error is reported
  // without the payload.
  it('gives a message up after ten attempts and reports it', async () => {
    const type = newType();
    await enqueue(type, { transferId: 't-dead' });
    const reporter = new RecordingReporter();
    const failing = () => Promise.reject(new Error('down'));

    for (let attempt = 0; attempt < 10; attempt++) {
      await workerFor(type, failing, { now: later(attempt * 600_000), reporter }).runOnce();
    }

    expect(await messagesOf(type)).toMatchObject([{ status: 'DEAD', attempts: 10 }]);
    expect(reporter.reports).toHaveLength(1);
    expect(reporter.reports[0]?.request).toEqual({
      requestId: 'req-1',
      method: 'OUTBOX',
      route: type,
    });
    expect(JSON.stringify(reporter.reports[0])).not.toContain('t-dead');
  });

  it('hands each message to one worker when two run at once', async () => {
    const type = newType();
    for (let i = 0; i < 5; i++) await enqueue(type, { n: i });
    const seen: number[] = [];
    const handler: OutboxHandler = (message) => {
      seen.push(Number(message.payload.n));
      return Promise.resolve();
    };

    await Promise.all([workerFor(type, handler).runOnce(), workerFor(type, handler).runOnce()]);

    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('holds no lock on the message while the handler runs', async () => {
    const type = newType();
    await enqueue(type);
    let lockedDuringHandler: boolean | undefined;

    await workerFor(type, async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'SELECT 1 FROM platform.outbox_messages WHERE type = $1 FOR UPDATE NOWAIT',
          [type],
        );
        lockedDuringHandler = false;
      } catch {
        lockedDuringHandler = true;
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    }).runOnce();

    expect(lockedDuringHandler).toBe(false);
  });

  // At least once: a worker that dies leaves its claim behind, which runs out.
  it("takes a dead worker's message again once its claim runs out", async () => {
    const type = newType();
    await enqueue(type);
    const now = Date.now();
    await pool.query('UPDATE platform.outbox_messages SET locked_until = $2 WHERE type = $1', [
      type,
      new Date(now + 30_000),
    ]);
    let calls = 0;
    const counting: OutboxHandler = () => {
      calls++;
      return Promise.resolve();
    };

    await workerFor(type, counting, { now: () => new Date(now) }).runOnce();
    expect(calls).toBe(0);
    await workerFor(type, counting, { now: () => new Date(now + 31_000) }).runOnce();
    expect(calls).toBe(1);
  });
});
