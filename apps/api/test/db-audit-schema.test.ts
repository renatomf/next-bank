import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl, testMigrationDatabaseUrl } from './helpers.ts';

// The audit trail is append-only in the database itself (API-05, T-DB-04).
describe('audit.audit_events', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insertEvent(overrides: Record<string, unknown> = {}): Promise<string> {
    const event = {
      id: randomUUID(),
      actor_type: 'USER',
      actor_id: randomUUID(),
      action: 'LOGIN_FAILED',
      subject_type: 'USER',
      subject_id: randomUUID(),
      request_id: 'req-1',
      metadata: {},
      ...overrides,
    };
    await app.query(
      `INSERT INTO audit.audit_events
         (id, occurred_at, actor_type, actor_id, action, subject_type, subject_id, request_id, metadata)
       VALUES ($1, now(), $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.id,
        event.actor_type,
        event.actor_id,
        event.action,
        event.subject_type,
        event.subject_id,
        event.request_id,
        event.metadata,
      ],
    );
    return event.id;
  }

  it('lets the API record an event', async () => {
    const id = await insertEvent();

    const { rows } = await app.query('SELECT action FROM audit.audit_events WHERE id = $1', [id]);
    expect(rows).toEqual([{ action: 'LOGIN_FAILED' }]);
  });

  it('denies UPDATE, DELETE and TRUNCATE to the API role (T-DB-04)', async () => {
    const id = await insertEvent();

    await expect(
      app.query(`UPDATE audit.audit_events SET action = 'X' WHERE id = $1`, [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(app.query('DELETE FROM audit.audit_events WHERE id = $1', [id])).rejects.toThrow(
      /permission denied/,
    );
    await expect(app.query('TRUNCATE audit.audit_events')).rejects.toThrow(/permission denied/);
  });

  it('refuses changes even from the table owner (defense in depth, T-DB-04)', async () => {
    const id = await insertEvent();
    const owner = new pg.Client({ connectionString: testMigrationDatabaseUrl() });
    await owner.connect();
    try {
      await expect(
        owner.query(`UPDATE audit.audit_events SET action = 'X' WHERE id = $1`, [id]),
      ).rejects.toThrow(/append-only/);
      await expect(
        owner.query('DELETE FROM audit.audit_events WHERE id = $1', [id]),
      ).rejects.toThrow(/append-only/);
      await expect(owner.query('TRUNCATE audit.audit_events')).rejects.toThrow(/append-only/);
    } finally {
      await owner.end();
    }
  });

  it('requires an actor id unless the actor is the system', async () => {
    await expect(insertEvent({ actor_type: 'USER', actor_id: null })).rejects.toThrow(
      /audit_events_actor_id_check/,
    );
    await expect(insertEvent({ actor_type: 'SYSTEM', actor_id: null })).resolves.toBeDefined();
  });

  it('rejects unknown actor types and malformed actions', async () => {
    await expect(insertEvent({ actor_type: 'ROBOT' })).rejects.toThrow(/check constraint/);
    await expect(insertEvent({ action: 'login failed' })).rejects.toThrow(/check constraint/);
  });

  it('limits metadata to a small JSON object', async () => {
    await expect(insertEvent({ metadata: { note: 'x'.repeat(5000) } })).rejects.toThrow(
      /audit_events_metadata_check/,
    );
    await expect(insertEvent({ metadata: JSON.stringify([1, 2]) })).rejects.toThrow(
      /audit_events_metadata_check/,
    );
  });
});
