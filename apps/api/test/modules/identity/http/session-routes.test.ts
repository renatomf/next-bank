import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { fictitiousCpf, uniqueEmail } from '../fixtures.ts';

// POST /v1/auth/refresh and POST /v1/auth/logout, and deny-by-default
// authentication, against the real database and keys (AUTH-03, AUTH-06).
const security = testSecurity();
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
let app: FastifyInstance;
let nextIp = 1;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

beforeAll(() => {
  app = buildApp({ pool, logStream: logs.stream, security });
  // Test-only routes: one that forgets to declare itself public, one that does.
  void app.register((scope, _options, done) => {
    scope.get('/test/private', () => ({ reached: true }));
    scope.get('/test/public', { config: { public: true } }, () => ({ reached: true }));
    done();
  });
});

afterAll(async () => {
  await app.close();
});

function newIp(): string {
  return `192.0.2.${String(nextIp++)}`;
}

async function newSession(): Promise<Tokens> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      name: 'Maria Teste',
      email: uniqueEmail(),
      cpf: fictitiousCpf(),
      password: 'violet staple orbit 42',
    },
    remoteAddress: newIp(),
  });
  expect(response.statusCode).toBe(201);
  return response.json<Tokens>();
}

function refresh(refreshToken: string, requestId?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: { refreshToken },
    headers: requestId ? { 'x-request-id': requestId } : {},
  });
}

function logout(accessToken?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  });
}

/** Moves a replacement 11 s into the past: the grace window is over. */
async function ageReplacement(refreshToken: string): Promise<void> {
  await pool.query(
    `UPDATE identity.refresh_tokens SET replaced_at = replaced_at - interval '11 seconds'
     WHERE replaced_at IS NOT NULL AND session_id = (
       SELECT session_id FROM identity.refresh_tokens r
       WHERE r.token_hash = sha256(decode(translate($1, '-_', '+/') || '=', 'base64')))`,
    [refreshToken],
  );
}

async function activeTokensOf(refreshToken: string): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM identity.refresh_tokens
     WHERE replaced_at IS NULL AND session_id = (
       SELECT session_id FROM identity.refresh_tokens r
       WHERE r.token_hash = sha256(decode(translate($1, '-_', '+/') || '=', 'base64')))`,
    [refreshToken],
  );
  return rows[0]?.n ?? -1;
}

describe('POST /v1/auth/refresh', () => {
  it('answers a new pair with only the four token fields', async () => {
    const { refreshToken } = await newSession();

    const response = await refresh(refreshToken);

    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, string>>();
    expect(Object.keys(body).sort()).toEqual([
      'accessToken',
      'accessTokenExpiresAt',
      'refreshToken',
      'tokenType',
    ]);
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it('answers a lost response retried at once with a new pair (grace window)', async () => {
    const { refreshToken } = await newSession();
    await refresh(refreshToken);

    expect((await refresh(refreshToken)).statusCode).toBe(200);
  });

  it('revokes the whole session when a replaced token comes back after 10 s (AUTH-03)', async () => {
    const { refreshToken } = await newSession();
    const rotated = (await refresh(refreshToken)).json<Tokens>();
    await ageReplacement(refreshToken);
    const requestId = '0199cccc-0000-7000-8000-0000000000ee';

    const reused = await refresh(refreshToken, requestId);

    expect(reused.statusCode).toBe(401);
    expect(reused.json<{ code: string }>().code).toBe('RefreshTokenReuseDetected');
    // The legitimate holder's active token dies with the session.
    const active = await refresh(rotated.refreshToken);
    expect(active.json<{ code: string }>().code).toBe('SessionExpired');
    const { rows } = await pool.query<{ action: string }>(
      'SELECT action FROM audit.audit_events WHERE request_id = $1 ORDER BY action',
      [requestId],
    );
    expect(rows.map((r) => r.action)).toEqual(['REFRESH_REUSE_DETECTED', 'SESSION_REVOKED']);
  });

  it('keeps exactly one active token when two refreshes with one token run at once', async () => {
    const { refreshToken } = await newSession();

    const responses = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);

    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(await activeTokensOf(refreshToken)).toBe(1);
  });

  it.each([
    ['a malformed token', 'not-a-token'],
    ['a token it never issued', 'A'.repeat(43)],
  ])('refuses %s with SessionExpired', async (_case, token) => {
    const response = await refresh(token);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('SessionExpired');
  });

  it('refuses unknown fields (InvalidRequest)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'A'.repeat(43), userId: 'someone-else' },
    });

    expect(response.statusCode).toBe(422);
  });
});

describe('POST /v1/auth/logout', () => {
  it('ends the session: 204, then its refresh token is refused (AUTH-06)', async () => {
    const { accessToken, refreshToken } = await newSession();

    expect((await logout(accessToken)).statusCode).toBe(204);

    const afterLogout = await refresh(refreshToken);
    expect(afterLogout.statusCode).toBe(401);
    expect(afterLogout.json<{ code: string }>().code).toBe('SessionExpired');
  });

  it('is idempotent', async () => {
    const { accessToken } = await newSession();
    await logout(accessToken);

    expect((await logout(accessToken)).statusCode).toBe(204);
  });

  it('leaves no usable token whichever of logout and refresh runs first', async () => {
    const { accessToken, refreshToken } = await newSession();

    const [, refreshed] = await Promise.all([logout(accessToken), refresh(refreshToken)]);

    const next =
      refreshed.statusCode === 200 ? refreshed.json<Tokens>().refreshToken : refreshToken;
    expect((await refresh(next)).statusCode).toBe(401);
  });

  it.each([
    ['no token', undefined],
    ['a token that is not a JWT', 'not-a-jwt'],
  ])('requires authentication: %s → 401 Unauthenticated', async (_case, token) => {
    const response = await logout(token);

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('Unauthenticated');
    expect(response.headers['www-authenticate']).toBe('Bearer');
  });
});

describe('deny by default', () => {
  it('protects a route that does not declare itself public', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/private' });

    expect(response.statusCode).toBe(401);
    expect(response.json<{ code: string }>().code).toBe('Unauthenticated');
  });

  it('lets a valid access token through', async () => {
    const { accessToken } = await newSession();

    const response = await app.inject({
      method: 'GET',
      url: '/test/private',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
  });

  it('leaves declared public routes open', async () => {
    expect((await app.inject({ method: 'GET', url: '/test/public' })).statusCode).toBe(200);
  });

  it('still answers 404 for a route that does not exist', async () => {
    expect((await app.inject({ method: 'GET', url: '/nao-existe' })).statusCode).toBe(404);
  });

  it('keeps tokens out of the logs (API-04)', async () => {
    const { accessToken, refreshToken } = await newSession();
    await refresh(refreshToken);
    await logout(accessToken);

    expect(logs.raw()).not.toContain(refreshToken);
    expect(logs.raw()).not.toContain(accessToken);
  });
});
