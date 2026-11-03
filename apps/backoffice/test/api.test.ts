import { describe, expect, it } from 'vitest';
import { adminApi, CommandRefused, LoginRefused, SearchRefused, SessionEnded } from '../lib/api';

// The backoffice's client of the API's /admin routes (v1.3.0 plan, task 2;
// B2, STF-08): only the server calls it, always with the backoffice's key
// and a request id of its own, never cached (a member's answer never serves
// another), and a session the API refuses ends here too.
interface Call {
  url: string;
  method: string;
  headers: Headers;
  body: string;
  cache: RequestCache | undefined;
}

function recordingFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetch = async (input: Request) => {
    calls.push({
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: await input.text(),
      cache: input.cache,
    });
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetch };
}

const api = (fetch: (input: Request) => Promise<Response>, token?: string) =>
  adminApi({ baseUrl: 'https://api.example.test', apiKey: 'backoffice-key', token, fetch });

describe('adminApi', () => {
  it('signs in with the backoffice key, a request id and no cache', async () => {
    const { calls, fetch } = recordingFetch(200, {
      token: 'opaque-token',
      expiresAt: '2026-11-02T20:00:00.000Z',
      member: { name: 'Lia Operadora', role: 'OPERATOR' },
    });

    const session = await api(fetch).login({
      email: 'lia@example.com',
      password: 'a password',
      mfaCode: '123456',
    });

    expect(session).toEqual({
      token: 'opaque-token',
      expiresAt: new Date('2026-11-02T20:00:00.000Z'),
    });
    const [call] = calls;
    expect(call?.url).toBe('https://api.example.test/admin/v1/auth/login');
    expect(call?.method).toBe('POST');
    expect(call?.headers.get('x-backoffice-key')).toBe('backoffice-key');
    expect(call?.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.headers.get('authorization')).toBeNull();
    expect(call?.cache).toBe('no-store');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({
      email: 'lia@example.com',
      password: 'a password',
      mfaCode: '123456',
    });
  });

  it.each([
    [401, 'InvalidCredentials'],
    [429, 'TooManyAttempts'],
  ])('tells why a login was refused (%i)', async (status, code) => {
    const { fetch } = recordingFetch(status, { code });

    await expect(
      api(fetch).login({ email: 'lia@example.com', password: 'x', mfaCode: '000000' }),
    ).rejects.toEqual(new LoginRefused(code));
  });

  it('reads the member with the session token', async () => {
    const { calls, fetch } = recordingFetch(200, { name: 'Lia Operadora', role: 'ANALYST' });

    await expect(api(fetch, 'opaque-token').me()).resolves.toEqual({
      name: 'Lia Operadora',
      role: 'ANALYST',
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer opaque-token');
    expect(calls[0]?.headers.get('x-backoffice-key')).toBe('backoffice-key');
  });

  it('ends the session the API refuses', async () => {
    const { fetch } = recordingFetch(401, { code: 'StaffSessionExpired' });

    await expect(api(fetch, 'opaque-token').me()).rejects.toBeInstanceOf(SessionEnded);
  });

  it('signs out with the session token', async () => {
    const { calls, fetch } = recordingFetch(204, null);

    await api(fetch, 'opaque-token').logout();

    expect(calls[0]?.url).toBe('https://api.example.test/admin/v1/auth/logout');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer opaque-token');
  });

  // The customers (v1.3.0 plan, task 3): the term goes in the body, never in a URL (C2).
  it('searches customers by POST, with the term in the body', async () => {
    const { calls, fetch } = recordingFetch(200, { customers: [], truncated: false });

    await expect(api(fetch, 'opaque-token').searchCustomers('ana@example.test')).resolves.toEqual({
      customers: [],
      truncated: false,
    });
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('https://api.example.test/admin/v1/customers/search');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ query: 'ana@example.test' });
    expect(calls[0]?.cache).toBe('no-store');
  });

  it('tells why a search was refused', async () => {
    const { fetch } = recordingFetch(422, { code: 'InvalidCpf' });

    await expect(api(fetch, 'opaque-token').searchCustomers('11111111111')).rejects.toEqual(
      new SearchRefused('InvalidCpf'),
    );
  });

  it("reads a customer's card and statement, the statement from a cursor", async () => {
    const id = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const { calls, fetch } = recordingFetch(200, { items: [], nextCursor: null });

    await api(fetch, 'opaque-token').customer(id);
    await api(fetch, 'opaque-token').customerStatement(id, 'abc_DEF-1');

    expect(calls.map((call) => call.url)).toEqual([
      `https://api.example.test/admin/v1/customers/${id}`,
      `https://api.example.test/admin/v1/customers/${id}/statement?cursor=abc_DEF-1`,
    ]);
  });

  it('answers null for a customer the API does not show this member', async () => {
    const { fetch } = recordingFetch(404, { code: 'NotFound' });

    await expect(api(fetch, 'opaque-token').customer('x')).resolves.toBeNull();
    await expect(api(fetch, 'opaque-token').customerStatement('x', null)).resolves.toBeNull();
  });

  it('ends the session the API refuses on a customer read', async () => {
    const { fetch } = recordingFetch(401, { code: 'StaffSessionExpired' });

    await expect(api(fetch, 'opaque-token').customer('x')).rejects.toBeInstanceOf(SessionEnded);
  });

  // Blocking and the requests (v1.3.0 plan, task 4): every command carries
  // the key the form was rendered with, so a double click acts once (K6).
  it('blocks an account with the reason and the idempotency key of the form', async () => {
    const id = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const key = '0190f0b6-0000-7000-8000-000000000001';
    const { calls, fetch } = recordingFetch(204, null);

    await api(fetch, 'opaque-token').blockAccount(id, 'FRAUD_SUSPECTED', key);

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe(`https://api.example.test/admin/v1/customers/${id}/block`);
    expect(calls[0]?.headers.get('idempotency-key')).toBe(key);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ reason: 'FRAUD_SUSPECTED' });
  });

  it('opens, decides and cancels requests at their routes', async () => {
    const id = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const key = '0190f0b6-0000-7000-8000-000000000002';
    const { calls, fetch } = recordingFetch(200, { id });
    const client = api(fetch, 'opaque-token');

    await client.requestUnblock(id, 'CUSTOMER_REQUEST', 'Ligou', key);
    await client.decideRequest(id, 'approve', null, key);
    await client.decideRequest(id, 'reject', 'Sem documento', key);
    await client.cancelRequest(id, key);

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.test/admin/v1/requests',
      `https://api.example.test/admin/v1/requests/${id}/approve`,
      `https://api.example.test/admin/v1/requests/${id}/reject`,
      `https://api.example.test/admin/v1/requests/${id}/cancel`,
    ]);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
      kind: 'UNBLOCK_ACCOUNT',
      customerId: id,
      reason: 'CUSTOMER_REQUEST',
      note: 'Ligou',
    });
    expect(calls.every((call) => call.headers.get('idempotency-key') === key)).toBe(true);
  });

  it('lists the requests by status, from a cursor', async () => {
    const { calls, fetch } = recordingFetch(200, { items: [], nextCursor: null });

    await api(fetch, 'opaque-token').listRequests('ALL', 'abc_DEF-1');

    expect(calls[0]?.url).toBe(
      'https://api.example.test/admin/v1/requests?status=ALL&cursor=abc_DEF-1',
    );
  });

  it.each([
    [409, 'AccountAlreadyBlocked'],
    [403, 'SelfApprovalNotAllowed'],
    [403, 'DemoCustomerProtected'],
  ])('tells why a command was refused (%i %s)', async (status, code) => {
    const { fetch } = recordingFetch(status, { code });

    await expect(api(fetch, 'opaque-token').blockAccount('x', 'OTHER', 'k')).rejects.toEqual(
      new CommandRefused(code),
    );
  });

  // v1.3.0 plan, task 5: the reversal names the Pix, never an amount (PIX-14).
  it('asks to reverse a Pix by its id, with the form key', async () => {
    const transferId = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const key = '0190f0b6-0000-7000-8000-000000000003';
    const { calls, fetch } = recordingFetch(201, { id: transferId });

    await api(fetch, 'opaque-token').requestReversal(transferId, 'FRAUD_SUSPECTED', null, key);

    expect(calls[0]?.url).toBe('https://api.example.test/admin/v1/requests');
    expect(calls[0]?.headers.get('idempotency-key')).toBe(key);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
      kind: 'REVERSE_PIX',
      transferId,
      reason: 'FRAUD_SUSPECTED',
      note: null,
    });
  });

  // v1.3.0 plan, task 6: the reconciliation's exceptions, and how the staff resolves them.
  it('lists the exceptions by status, from a cursor, and reads one', async () => {
    const id = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const { calls, fetch } = recordingFetch(200, { items: [], nextCursor: null });
    const client = api(fetch, 'opaque-token');

    await client.listExceptions('ALL', 'abc_DEF-1');
    await client.exception(id);

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.test/admin/v1/exceptions?status=ALL&cursor=abc_DEF-1',
      `https://api.example.test/admin/v1/exceptions/${id}`,
    ]);
  });

  it('reads no exception the API does not show this member', async () => {
    const { fetch } = recordingFetch(404, { code: 'NotFound' });

    await expect(api(fetch, 'opaque-token').exception('x')).resolves.toBeNull();
  });

  it('asks to settle or refund an exception, and explains one, with the form key', async () => {
    const exceptionId = '0190f0b6-1b2c-7d3e-8f40-123456789abc';
    const key = '0190f0b6-0000-7000-8000-000000000004';
    const { calls, fetch } = recordingFetch(201, { id: exceptionId });
    const client = api(fetch, 'opaque-token');

    await client.requestResolution(exceptionId, 'REFUND', 'OTHER', 'Conferido no SPI', key);
    await client.explainException(exceptionId, 'Tarifa lançada no dia seguinte.', key);

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.test/admin/v1/requests',
      `https://api.example.test/admin/v1/exceptions/${exceptionId}/explain`,
    ]);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({
      kind: 'RESOLVE_EXCEPTION',
      exceptionId,
      resolution: 'REFUND',
      reason: 'OTHER',
      note: 'Conferido no SPI',
    });
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({
      explanation: 'Tarifa lançada no dia seguinte.',
    });
    expect(calls.every((call) => call.headers.get('idempotency-key') === key)).toBe(true);
  });

  it('tells why an explanation was refused', async () => {
    const { fetch } = recordingFetch(409, { code: 'ExceptionNotOpen' });

    await expect(
      api(fetch, 'opaque-token').explainException('x', 'Explicação qualquer.', 'k'),
    ).rejects.toEqual(new CommandRefused('ExceptionNotOpen'));
  });
});
