import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl, testMigrationDatabaseUrl } from './helpers.ts';

// The requests that need two people, in the database itself (v1.3.0 plan,
// task 4): append-only (STF-10), one decision per request (STF-09), and the
// one who asked never approves or rejects, only cancels (STF-03).
const app = new pg.Client({ connectionString: testDatabaseUrl() });
const owner = new pg.Client({ connectionString: testMigrationDatabaseUrl() });

beforeAll(async () => {
  await app.connect();
  await owner.connect();
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

async function insertRequest(overrides: Record<string, unknown> = {}) {
  const request = {
    id: randomUUID(),
    kind: 'UNBLOCK_ACCOUNT',
    customer_id: randomUUID(),
    reason: 'CUSTOMER_REQUEST',
    note: null,
    requested_by: randomUUID(),
    requested_at: new Date('2026-11-02T12:00:00.000Z'),
    expires_at: new Date('2026-11-03T12:00:00.000Z'),
    demo_scope: false,
    ...overrides,
  };
  await app.query(
    `INSERT INTO operations.requests
       (id, kind, customer_id, reason, note, requested_by, requested_at, expires_at, demo_scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      request.id,
      request.kind,
      request.customer_id,
      request.reason,
      request.note,
      request.requested_by,
      request.requested_at,
      request.expires_at,
      request.demo_scope,
    ],
  );
  return request;
}

function insertDecision(
  request: { id: string; requested_by: string },
  decision: string,
  decidedBy: string,
) {
  return app.query(
    `INSERT INTO operations.decisions
       (request_id, requested_by, decision, decided_by, decided_at, note)
     VALUES ($1, $2, $3, $4, now(), NULL)`,
    [request.id, request.requested_by, decision, decidedBy],
  );
}

describe('operations.requests and operations.decisions', () => {
  it('records a request and another person deciding it', async () => {
    const request = await insertRequest();

    await expect(insertDecision(request, 'APPROVED', randomUUID())).resolves.toBeDefined();
  });

  it('refuses an approval or a rejection by the requester (STF-03)', async () => {
    const request = await insertRequest();

    for (const decision of ['APPROVED', 'REJECTED']) {
      await expect(insertDecision(request, decision, request.requested_by)).rejects.toThrow(
        /decisions_decided_by_check/,
      );
    }
  });

  it('lets only the requester cancel', async () => {
    const request = await insertRequest();

    await expect(insertDecision(request, 'CANCELLED', randomUUID())).rejects.toThrow(
      /decisions_decided_by_check/,
    );
    await expect(insertDecision(request, 'CANCELLED', request.requested_by)).resolves.toBeDefined();
  });

  it('keeps one decision per request (STF-09)', async () => {
    const request = await insertRequest();
    await insertDecision(request, 'APPROVED', randomUUID());

    await expect(insertDecision(request, 'REJECTED', randomUUID())).rejects.toThrow(
      /decisions_pkey/,
    );
  });

  it('ties the decision to the request and its requester', async () => {
    const request = await insertRequest();

    // Someone else posing as the requester to cancel: no such request.
    const impostor = randomUUID();
    await expect(
      insertDecision({ id: request.id, requested_by: impostor }, 'CANCELLED', impostor),
    ).rejects.toThrow(/decisions_request_fkey/);
  });

  it('expires every request 24 hours after it was opened (K4)', async () => {
    await expect(
      insertRequest({ expires_at: new Date('2026-11-04T12:00:00.000Z') }),
    ).rejects.toThrow(/requests_expires_at_check/);
  });

  it('refuses unknown kinds, reasons and decisions, and a note over 500', async () => {
    await expect(insertRequest({ kind: 'DELETE_EVERYTHING' })).rejects.toThrow(
      /requests_kind_check/,
    );
    await expect(insertRequest({ reason: 'BORED' })).rejects.toThrow(/requests_reason_check/);
    await expect(insertRequest({ note: 'x'.repeat(501) })).rejects.toThrow(/requests_note_check/);
    const request = await insertRequest();
    await expect(insertDecision(request, 'MAYBE', randomUUID())).rejects.toThrow(
      /decisions_decision_check/,
    );
  });

  it('lets the API lock a request, and still never change it (STF-09, STF-10)', async () => {
    const request = await insertRequest();

    await app.query('BEGIN');
    try {
      await expect(
        app.query('SELECT id FROM operations.requests WHERE id = $1 FOR UPDATE', [request.id]),
      ).resolves.toBeDefined();
    } finally {
      await app.query('ROLLBACK');
    }
    await expect(
      app.query('UPDATE operations.requests SET id = id WHERE id = $1', [request.id]),
    ).rejects.toThrow(/append-only/);
  });

  it('denies UPDATE and DELETE to the API role (STF-10)', async () => {
    const request = await insertRequest();
    await insertDecision(request, 'REJECTED', randomUUID());

    for (const table of ['requests', 'decisions']) {
      const column = table === 'requests' ? 'id' : 'request_id';
      await expect(
        app.query(`UPDATE operations.${table} SET note = 'x' WHERE ${column} = $1`, [request.id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        app.query(`DELETE FROM operations.${table} WHERE ${column} = $1`, [request.id]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('refuses changes even from the owner (defense in depth, STF-10)', async () => {
    const request = await insertRequest();

    await expect(
      owner.query(`UPDATE operations.requests SET note = 'x' WHERE id = $1`, [request.id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      owner.query('DELETE FROM operations.requests WHERE id = $1', [request.id]),
    ).rejects.toThrow(/append-only/);
  });
});

describe('identity, for the block (task 4)', () => {
  it('lets the API lock a customer but never mark one protected (K5, STF-13)', async () => {
    const { rows } = await owner.query<{ id: string }>('SELECT id FROM identity.users LIMIT 1');
    const id = rows[0]?.id ?? randomUUID();

    await expect(
      app.query(`UPDATE identity.users SET status = status, updated_at = now() WHERE id = $1`, [
        id,
      ]),
    ).resolves.toBeDefined();
    await expect(
      app.query('UPDATE identity.users SET demo_protected = true WHERE id = $1', [id]),
    ).rejects.toThrow(/permission denied/);
  });

  it('knows a session revoked by a block', async () => {
    const { rows } = await owner.query<{ check: string }>(
      `SELECT pg_get_constraintdef(oid) AS check FROM pg_constraint
       WHERE conname = 'sessions_revoked_reason_check'`,
    );

    expect(rows[0]?.check).toContain('ACCOUNT_BLOCKED');
  });
});
