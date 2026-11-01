import { trace } from '@opentelemetry/api';
import * as Sentry from '@sentry/node';
import { afterAll, describe, expect, it } from 'vitest';
import { SentryErrorReporter } from '../../../src/shared/infrastructure/sentry-error-reporter.ts';
import { recordSpans } from '../../tracing.ts';

// Sentry and the trace in one process (v1.2.0 plan, task 8, T2): the
// OpenTelemetry setup has one owner, the API's tracing; Sentry, which only
// reports errors, leaves it alone and still reports them.
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
    trace.getTracer('test').startSpan('after Sentry').end();

    expect(spans().map((span) => span.name)).toEqual(['after Sentry']);
  });
});
