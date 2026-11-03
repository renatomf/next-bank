import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Secret, TOTP } from 'otpauth';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../../src/app.ts';
import { createPool } from '../../../../src/shared/db.ts';
import { staffCreator } from '../../../../scripts/create-staff.ts';
import { captureLogs, testDatabaseUrl, testSecurity } from '../../../helpers.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import { uniqueEmail } from '../../identity/fixtures.ts';

// The admin manages the staff (v1.3.0 plan, task 7), against the real
// Postgres: creates an operator or an analyst whose credentials work and show
// once, never in a log nor in an idempotency record (STF-15); switches a
// member's role, which counts on its next request (STF-02); disables one,
// whose session ends at once (STF-06). Never itself, never an admin (G1,
// STF-14), and only the admin (C1).
const BACKOFFICE_KEY = randomBytes(32).toString('base64');
const TOTP_KEY = randomBytes(32);
const pool = createPool(testDatabaseUrl());
const logs = captureLogs();
const clock = new FixedClock(new Date());
const creator = staffCreator({ pool, totpKey: TOTP_KEY, clock });
let app: FastifyInstance;

beforeAll(() => {
  app = buildApp({
    pool,
    logStream: logs.stream,
    security: testSecurity(),
    backoffice: { apiKey: BACKOFFICE_KEY, totpKey: TOTP_KEY },
    clock,
  });
});
afterAll(async () => {
  await app.close();
});

/** Signs in with the credentials as created; the step of each code is used once. */
async function signIn(credentials: { email: string; password: string; totpSecret: string }) {
  clock.current = new Date(clock.now().getTime() + 30_000);
  const totp = new TOTP({ secret: Secret.fromBase32(credentials.totpSecret) });
  return app.inject({
    method: 'POST',
    url: '/admin/v1/auth/login',
    headers: { 'x-backoffice-key': BACKOFFICE_KEY },
    payload: {
      email: credentials.email,
      password: credentials.password,
      mfaCode: totp.generate({ timestamp: clock.now().getTime() }),
    },
  });
}

async function member(role: 'OPERATOR' | 'ANALYST' | 'ADMIN') {
  const created = await creator.execute({ email: uniqueEmail(), name: 'Lia', role, isDemo: false });
  const response = await signIn(created);
  expect(response.statusCode, response.body).toBe(200);
  return { id: created.id, token: response.json<{ token: string }>().token };
}

const headers = (token: string) => ({
  'x-backoffice-key': BACKOFFICE_KEY,
  authorization: `Bearer ${token}`,
});

const createMember = (token: string, email: string, role = 'OPERATOR') =>
  app.inject({
    method: 'POST',
    url: '/admin/v1/staff',
    headers: headers(token),
    payload: { name: 'Nina Operadora', email, role },
  });

const changeRole = (token: string, id: string, role: string) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/staff/${id}/role`,
    headers: headers(token),
    payload: { role },
  });

const disable = (token: string, id: string) =>
  app.inject({
    method: 'POST',
    url: `/admin/v1/staff/${id}/disable`,
    headers: headers(token),
    payload: {},
  });

const me = (token: string) =>
  app.inject({ method: 'GET', url: '/admin/v1/me', headers: headers(token) });

describe('the staff management', () => {
  it('creates an operator whose credentials work, shown once and never kept (STF-15)', async () => {
    const { token } = await member('ADMIN');
    const email = uniqueEmail();

    const created = await createMember(token, email);

    expect(created.statusCode, created.body).toBe(201);
    const body = created.json<{
      member: { id: string; email: string; role: string; status: string; isDemo: boolean };
      credentials: { password: string; totpSecret: string; totpUri: string };
    }>();
    expect(body.member).toMatchObject({ email, role: 'OPERATOR', status: 'ACTIVE', isDemo: false });
    expect(created.headers['cache-control']).toBe('no-store');
    const signedIn = await signIn({ email, ...body.credentials });
    expect(signedIn.statusCode, signedIn.body).toBe(200);
    expect(logs.raw()).not.toContain(body.credentials.password);
    expect(logs.raw()).not.toContain(body.credentials.totpSecret);
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM platform.idempotency_records
       WHERE response_body::text LIKE '%' || $1 || '%'`,
      [body.credentials.password],
    );
    expect(rows[0]?.n).toBe(0);
    const audit = await pool.query<{ actor_type: string; actor_id: string }>(
      `SELECT actor_type, actor_id FROM audit.audit_events
       WHERE action = 'STAFF_MEMBER_CREATED' AND subject_id = $1`,
      [body.member.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]?.actor_type).toBe('STAFF');
  });

  it('never creates an admin, nor the same e-mail twice, even at once (G1)', async () => {
    const { token } = await member('ADMIN');
    const email = uniqueEmail();

    expect((await createMember(token, uniqueEmail(), 'ADMIN')).statusCode).toBe(422);
    const answers = await Promise.all([createMember(token, email), createMember(token, email)]);

    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([201, 409]);
  });

  it('switches a role, which counts on the next request with no new login (STF-02)', async () => {
    const { token } = await member('ADMIN');
    const operator = await member('OPERATOR');

    const changed = await changeRole(token, operator.id, 'ANALYST');

    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json()).toMatchObject({ id: operator.id, role: 'ANALYST' });
    expect((await me(operator.token)).json()).toMatchObject({ role: 'ANALYST' });
  });

  it('disables a member, whose session ends at once (STF-06)', async () => {
    const { token } = await member('ADMIN');
    const operator = await member('OPERATOR');

    const disabled = await disable(token, operator.id);

    expect(disabled.statusCode, disabled.body).toBe(200);
    expect(disabled.json()).toMatchObject({ status: 'DISABLED' });
    expect((await me(operator.token)).statusCode).toBe(401);
    const again = await disable(token, operator.id);
    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('StaffMemberDisabled');
  });

  it('never lets the admin change itself nor another admin (STF-14)', async () => {
    const self = await member('ADMIN');
    const other = await member('ADMIN');

    for (const response of [
      await changeRole(self.token, self.id, 'ANALYST'),
      await disable(self.token, self.id),
    ]) {
      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('StaffSelfChangeNotAllowed');
    }
    const touched = await disable(self.token, other.id);
    expect(touched.statusCode).toBe(403);
    expect(touched.json<{ code: string }>().code).toBe('AdminNotManaged');
  });

  it('never leaves a disabled member with its role changed after, racing both', async () => {
    const { token } = await member('ADMIN');
    const operator = await member('OPERATOR');

    const [changed, disabled] = await Promise.all([
      changeRole(token, operator.id, 'ANALYST'),
      disable(token, operator.id),
    ]);

    expect(disabled.statusCode).toBe(200);
    expect([200, 409]).toContain(changed.statusCode);
    const { rows } = await pool.query<{ role: string; status: string }>(
      'SELECT role, status FROM staff.members WHERE id = $1',
      [operator.id],
    );
    expect(rows[0]?.status).toBe('DISABLED');
    if (changed.statusCode === 409) expect(rows[0]?.role).toBe('OPERATOR');
  });

  it('lists the staff newest first, without credentials', async () => {
    const { token } = await member('ADMIN');
    const email = uniqueEmail();
    await createMember(token, email);

    const page = await app.inject({
      method: 'GET',
      url: '/admin/v1/staff',
      headers: headers(token),
    });

    expect(page.statusCode, page.body).toBe(200);
    const items = page.json<{ items: Record<string, unknown>[] }>().items;
    expect(items[0]).toMatchObject({ email, role: 'OPERATOR' });
    expect(Object.keys(items[0] ?? {})).not.toContain('password');
    const bad = await app.inject({
      method: 'GET',
      url: '/admin/v1/staff?cursor=bm90LWEtY3Vyc29y',
      headers: headers(token),
    });
    expect(bad.statusCode).toBe(422);
  });

  it.each(['OPERATOR', 'ANALYST'] as const)('keeps the %s out (C1, STF-02)', async (role) => {
    const { token } = await member(role);

    expect(
      (await app.inject({ method: 'GET', url: '/admin/v1/staff', headers: headers(token) }))
        .statusCode,
    ).toBe(403);
    expect((await createMember(token, uniqueEmail())).statusCode).toBe(403);
  });
});
