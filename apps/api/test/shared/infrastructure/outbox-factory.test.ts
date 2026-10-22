import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { OutboxHandler } from '../../../src/shared/application/outbox.ts';
import { createPool } from '../../../src/shared/db.ts';
import { createOutbox } from '../../../src/shared/infrastructure/outbox-factory.ts';
import { PgUnitOfWork } from '../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../src/shared/infrastructure/system-ports.ts';
import { testDatabaseUrl } from '../../helpers.ts';

// Review of task 2: the types the outbox takes and the types the worker
// delivers come from one map of handlers, so a message can never be written
// that no worker will deliver.
const pool = createPool(testDatabaseUrl());
const unitOfWork = new PgUnitOfWork(pool);

afterAll(async () => {
  await pool.end();
});

function build(handlers: ReadonlyMap<string, OutboxHandler>) {
  return createOutbox({
    pool,
    ids: new UuidV7Generator(),
    clock: () => new Date(),
    errorReporter: { report: () => undefined },
    handlers,
  });
}

describe('createOutbox', () => {
  it('delivers every message it takes, with the handler of its type', async () => {
    const type = `test.t${randomUUID().slice(0, 8)}`;
    const seen: string[] = [];
    const { outbox, worker } = build(
      new Map([
        [
          type,
          (message) => {
            seen.push(String(message.payload.id));
            return Promise.resolve();
          },
        ],
      ]),
    );

    await unitOfWork.run((tx) =>
      outbox.enqueue(tx, { type, payload: { id: 'm-1' }, requestId: null }),
    );
    await worker.runOnce();

    expect(seen).toEqual(['m-1']);
  });

  it('refuses a type no handler delivers', async () => {
    const { outbox } = build(new Map());

    await expect(
      unitOfWork.run((tx) =>
        outbox.enqueue(tx, { type: 'test.nobody', payload: { id: 'm' }, requestId: null }),
      ),
    ).rejects.toThrow(/unknown outbox message type/);
  });
});
