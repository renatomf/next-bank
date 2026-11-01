import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { trace } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import { afterAll, describe, expect, it } from 'vitest';
import { SentryErrorReporter } from '../../../src/shared/infrastructure/sentry-error-reporter.ts';
import { recordSpans } from '../../tracing.ts';

// Sentry and the trace in one process (v1.2.0 plan, task 8, T2): the
// OpenTelemetry setup has one owner, the API's tracing; Sentry, which only
// reports errors, leaves it alone, makes no spans of its own and still
// reports them.
const { spans } = recordSpans();

/** What reaches Sentry's servers: the envelopes, kept in memory. */
const envelopes: unknown[] = [];
const transport = () => ({
  send: (envelope: unknown) => {
    envelopes.push(envelope);
    return Promise.resolve({});
  },
  flush: () => Promise.resolve(true),
});

afterAll(async () => {
  await Sentry.close();
});

function listening(server: Server): Promise<Server> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

describe('SentryErrorReporter beside the tracing', () => {
  const reporter = new SentryErrorReporter({
    dsn: 'https://public@o0.ingest.sentry.io/0',
    environment: 'test',
    transport,
  });

  it('still reports an error with its request id', async () => {
    reporter.report(new Error('boom'), { requestId: 'req-0001', method: 'GET', route: '/x' });
    await Sentry.flush(2_000);

    expect(JSON.stringify(envelopes)).toContain('"requestId":"req-0001"');
  });

  it('leaves the spans to the API tracing', () => {
    trace.getTracer('nextbank-api').startSpan('after Sentry').end();

    expect(spans().map((span) => span.name)).toEqual(['after Sentry']);
  });

  // Security review of task 8: Sentry's HTTP server span is named by the raw
  // path, which carries the Pix key a DICT lookup asks for (EXT-07).
  it('makes no span of its own for a request, whose path may carry a Pix key', async () => {
    const server = await listening(
      createServer((_request, response) => {
        response.end('ok');
      }),
    );
    try {
      const { port } = server.address() as AddressInfo;
      // Sentry instruments a server on its first request: the second is its own.
      for (let request = 0; request < 2; request += 1) {
        const url = `http://127.0.0.1:${String(port)}/dict/keys/clara.aurora@example.com`;
        await (await fetch(url)).text();
      }
    } finally {
      server.close();
    }
    await Sentry.flush(2_000);

    expect(JSON.stringify(spans().map((span) => [span.name, span.attributes]))).not.toContain(
      'clara',
    );
  });
});
