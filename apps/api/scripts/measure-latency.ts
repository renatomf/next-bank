// Measures the latency of the published API against the performance budget
// (CLAUDE.md, Performance; week 8 plan, task 5): reads and the whole Pix, as
// Bruno of the demo, one request at a time. /health is the network baseline.
// Bruno, not Ana: visitors use Ana, and her Pix key lookup quota stays theirs.
//   MEASURE_API_URL=https://... pnpm --filter @nextbank/api measure
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { DEMO_ACCOUNTS } from './seed-demo.ts';

// Under the global limit of 100 requests per minute per IP (API-02): a 429
// would measure the limit, not the API.
const PACE_MS = 750;
const ROUNDS = 36;
// One Pix every third round: R$ 0,01 from Bruno to Ana, gone at the next
// daily reset (DEMO-02). Looking up the key and creating the Pix each spend
// one of the payer's 30 lookups an hour (PIX-07): 12 Pix spend 24.
const PIX_EVERY = 3;

/** Nearest-rank percentile: always a latency that was actually measured. */
export function percentile(samples: readonly number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const value = sorted[Math.max(Math.ceil((p / 100) * sorted.length), 1) - 1];
  if (value === undefined) throw new Error('percentile: no samples');
  return value;
}

interface Route {
  name: string;
  /** The budget in milliseconds, if the route has one. */
  budget?: number;
}

const ROUTES = {
  health: { name: 'GET /health' },
  account: { name: 'GET /v1/me/account', budget: 200 },
  statement: { name: 'GET /v1/me/statement', budget: 200 },
  keyLookup: { name: 'POST /v1/pix/key-lookups', budget: 200 },
  createPix: { name: 'POST /v1/pix/transfers', budget: 400 },
  authorizePix: { name: 'POST /v1/pix/transfers/{id}/authorize', budget: 400 },
} satisfies Record<string, Route>;

type RouteKey = keyof typeof ROUTES;

interface Call {
  method: 'GET' | 'POST';
  path: string;
  expected: number;
  token?: string;
  payload?: unknown;
  headers?: Record<string, string>;
}

class Measurement {
  readonly samples = new Map<RouteKey, number[]>();

  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  /** Sends one request, timed until its body is read, then waits the pace. */
  async call(call: Call, route?: RouteKey): Promise<unknown> {
    const started = performance.now();
    const response = await fetch(new URL(call.path, this.#baseUrl), {
      method: call.method,
      headers: {
        ...(call.payload === undefined ? {} : { 'content-type': 'application/json' }),
        ...(call.token ? { authorization: `Bearer ${call.token}` } : {}),
        ...call.headers,
      },
      ...(call.payload === undefined ? {} : { body: JSON.stringify(call.payload) }),
    });
    const text = await response.text();
    const elapsed = performance.now() - started;
    if (response.status === 429) {
      throw new Error('Measurement: rate limited (429); wait a minute and run again');
    }
    if (response.status !== call.expected) {
      throw new Error(
        `Measurement: ${call.method} ${call.path} answered ${String(response.status)}`,
      );
    }
    if (route) this.samples.set(route, [...(this.samples.get(route) ?? []), elapsed]);
    await sleep(PACE_MS);
    return text ? (JSON.parse(text) as unknown) : null;
  }
}

function field(body: unknown, name: string): string {
  const value = (body as Record<string, unknown> | null)?.[name];
  if (typeof value !== 'string') throw new Error(`Measurement: no ${name} in the answer`);
  return value;
}

async function measure(baseUrl: string): Promise<Measurement> {
  const [ana, bruno] = DEMO_ACCOUNTS;
  if (!ana || !bruno) throw new Error('Measurement: the demo accounts are missing');
  const run = new Measurement(baseUrl);

  // Untimed: wakes the free instance (up to a minute) and warms the routes.
  await run.call({ method: 'GET', path: '/health', expected: 200 });
  const login = await run.call({
    method: 'POST',
    path: '/v1/auth/login',
    expected: 200,
    payload: { email: bruno.email, password: bruno.password },
  });
  const token = field(login, 'accessToken');
  await run.call({ method: 'GET', path: '/v1/me/account', expected: 200, token });

  const key = { type: 'CPF', value: ana.cpf };
  for (let round = 1; round <= ROUNDS; round++) {
    await run.call({ method: 'GET', path: '/health', expected: 200 }, 'health');
    await run.call({ method: 'GET', path: '/v1/me/account', expected: 200, token }, 'account');
    await run.call({ method: 'GET', path: '/v1/me/statement', expected: 200, token }, 'statement');
    if (round % PIX_EVERY !== 0) continue;
    await run.call(
      { method: 'POST', path: '/v1/pix/key-lookups', expected: 200, token, payload: key },
      'keyLookup',
    );
    const created = await run.call(
      {
        method: 'POST',
        path: '/v1/pix/transfers',
        expected: 201,
        token,
        headers: { 'idempotency-key': randomUUID() },
        payload: {
          key,
          amount: { amount: 1, currency: 'BRL' },
          description: 'Latency measurement',
        },
      },
      'createPix',
    );
    await run.call(
      {
        method: 'POST',
        path: `/v1/pix/transfers/${field(created, 'id')}/authorize`,
        expected: 200,
        token,
        headers: { 'idempotency-key': randomUUID() },
        payload: { pin: bruno.pin },
      },
      'authorizePix',
    );
  }
  await run.call({ method: 'POST', path: '/v1/auth/logout', expected: 204, token });
  return run;
}

/** The results as a Markdown table, in milliseconds. */
function report(run: Measurement): string {
  const lines = [
    '| Route | Samples | p50 | p95 | Max | Budget (p95) |',
    '|---|---|---|---|---|---|',
  ];
  for (const [key, route] of Object.entries(ROUTES) as [RouteKey, Route][]) {
    const samples = run.samples.get(key) ?? [];
    if (samples.length === 0) continue;
    const ms = (value: number) => String(Math.round(value));
    const budget = route.budget === undefined ? '-' : `< ${String(route.budget)}`;
    lines.push(
      `| ${route.name} | ${String(samples.length)} | ${ms(percentile(samples, 50))} | ${ms(percentile(samples, 95))} | ${ms(Math.max(...samples))} | ${budget} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

if (import.meta.main) {
  const baseUrl = process.env.MEASURE_API_URL;
  if (!baseUrl)
    throw new Error('MEASURE_API_URL is not set, e.g. https://next-bank-api.onrender.com');
  process.stdout.write(report(await measure(baseUrl)));
}
