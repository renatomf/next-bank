import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// GET /v1/me/sessions and POST /v1/me/sessions/{id}/revoke, against the real
// database (ASVS session: the customer sees and ends their own sessions;
// IDOR; AUTH-04; week 7 plan, D2 and D3).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

const PASSWORD = 'violet staple orbit 42';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface ActiveSession {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
});

afterAll(async () => {
  await app.close();
});

function newIp(): string {
  return `198.51.100.${String(nextIp++)}`;
}

/** A customer with one session from the registration. */
async function newCustomer(): Promise<{ email: string; first: Tokens }> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: 'Maria Teste', email, cpf: fictitiousCpf(), password: PASSWORD },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(201);
  return { email, first: response.json<Tokens>() };
}

/** Another session of the same customer, from a login on another device. */
async function login(email: string, deviceLabel?: string): Promise<Tokens> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: PASSWORD, ...(deviceLabel ? { deviceLabel } : {}) },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(200);
  return response.json<Tokens>();
}

function listSessions(tokens: Tokens) {
  return app.inject({
    method: 'GET',
    url: '/v1/me/sessions',
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
}

async function sessionsOf(tokens: Tokens): Promise<ActiveSession[]> {
  const response = await listSessions(tokens);
  expect(response.statusCode).toBe(200);
  return response.json<{ items: ActiveSession[] }>().items;
}

async function idOf(tokens: Tokens): Promise<string> {
  const current = (await sessionsOf(tokens)).find((session) => session.current);
  if (!current) throw new Error('no current session');
  return current.id;
}

function revoke(tokens: Tokens, sessionId: string) {
  return app.inject({
    method: 'POST',
    url: `/v1/me/sessions/${sessionId}/revoke`,
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
}

function refresh(tokens: Tokens) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken: tokens.refreshToken },
  });
}

describe('GET /v1/me/sessions', () => {
  it('lists the active sessions of the caller, marking the current one', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');

    const sessions = await sessionsOf(phone);

    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      // Only the approved fields: no IP, token or user (READ-02).
      expect(Object.keys(session).sort()).toEqual([
        'createdAt',
        'current',
        'deviceLabel',
        'id',
        'lastUsedAt',
      ]);
    }
    const current = sessions.filter((session) => session.current);
    expect(current).toHaveLength(1);
    expect(current[0]?.deviceLabel).toBe('Android 15');
    expect(sessions.find((session) => !session.current)?.deviceLabel).toBeNull();
    expect(await idOf(first)).not.toBe(current[0]?.id);
  });

  it('lists the most recently used first', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    expect((await refresh(first)).statusCode).toBe(200);

    const sessions = await sessionsOf(phone);

    expect(sessions.map((session) => session.current)).toEqual([false, true]);
  });

  it('leaves out the sessions that ended', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { authorization: `Bearer ${first.accessToken}` },
    });
    expect(logout.statusCode).toBe(204);

    const sessions = await sessionsOf(phone);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.current).toBe(true);
  });

  // READ-01: only the caller's sessions, whatever is sent.
  it('never lists the sessions of another customer', async () => {
    const ana = await newCustomer();
    const bruno = await newCustomer();
    await login(bruno.email, 'iOS 18');

    const sessions = await sessionsOf(ana.first);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.current).toBe(true);
  });

  it('refuses any query parameter', async () => {
    const { first } = await newCustomer();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/sessions?userId=someone',
      headers: { authorization: `Bearer ${first.accessToken}` },
    });

    expect(response.statusCode).toBe(422);
  });

  it('asks for authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/me/sessions' });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /v1/me/sessions/{id}/revoke', () => {
  it('ends another session of the caller: its refresh stops working', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const firstId = await idOf(first);

    const response = await revoke(phone, firstId);

    expect(response.statusCode).toBe(204);
    expect((await refresh(first)).statusCode).toBe(401);
    expect((await sessionsOf(phone)).map((session) => session.id)).not.toContain(firstId);
  });

  it('records the revocation in the audit, in the same transaction', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const firstId = await idOf(first);

    await revoke(phone, firstId);

    const audit = await pool.query<{ action: string; metadata: unknown }>(
      `SELECT action, metadata FROM audit.audit_events
       WHERE subject_id = $1 AND action = 'SESSION_REVOKED'`,
      [firstId],
    );
    expect(audit.rows).toEqual([
      { action: 'SESSION_REVOKED', metadata: { reason: 'LOGOUT', by: 'ANOTHER_SESSION' } },
    ]);
  });

  // IDOR (attack first): another customer's session is not found, and lives on.
  it('does not find the session of another customer', async () => {
    const ana = await newCustomer();
    const bruno = await newCustomer();
    const brunoId = await idOf(bruno.first);

    const response = await revoke(ana.first, brunoId);

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('NotFound');
    expect((await refresh(bruno.first)).statusCode).toBe(200);
  });

  it('does not find a session that does not exist or already ended', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const firstId = await idOf(first);
    await revoke(phone, firstId);

    for (const id of [firstId, crypto.randomUUID()]) {
      const response = await revoke(phone, id);
      expect(response.statusCode).toBe(404);
    }
  });

  // D3: the current session ends by signing out, not from the list.
  it('refuses to end the session of the token itself', async () => {
    const { first } = await newCustomer();

    const response = await revoke(first, await idOf(first));

    expect(response.statusCode).toBe(422);
    expect((await refresh(first)).statusCode).toBe(200);
  });

  it('refuses an id that is not a UUID', async () => {
    const { first } = await newCustomer();

    const response = await revoke(first, 'not-a-session');

    expect(response.statusCode).toBe(422);
  });

  // AUTH-04: a token whose session already ended cannot end the others.
  it('refuses the token of a session that already ended', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const phoneId = await idOf(phone);
    await revoke(first, phoneId);

    const list = await listSessions(phone);
    const response = await revoke(phone, await idOf(first));

    expect(list.statusCode).toBe(401);
    expect(response.statusCode).toBe(401);
    expect((await refresh(first)).statusCode).toBe(200);
  });

  // Concurrency: ending a session while it refreshes never leaves it alive.
  it('ends a session that is refreshing at the same time', async () => {
    const { email, first } = await newCustomer();
    const phone = await login(email, 'Android 15');
    const firstId = await idOf(first);

    const [refreshed, revoked] = await Promise.all([refresh(first), revoke(phone, firstId)]);

    expect(revoked.statusCode).toBe(204);
    // Whoever ran first, no token of that session renews afterwards.
    const latest = refreshed.statusCode === 200 ? refreshed.json<Tokens>() : first;
    expect((await refresh(latest)).statusCode).toBe(401);
  });
});
