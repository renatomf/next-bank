import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-node';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { startTracing, type Tracing } from '../src/shared/infrastructure/tracing.ts';

/**
 * The tracing of production for the tests of a file, exporting each span as
 * it ends to memory, through the filter of the allowed attributes (EXT-07).
 * Stopped after the file, so the next one starts without it.
 */
export function recordSpans(): {
  spans: () => ReadableSpan[];
  /** The spans of the trace [span] belongs to. */
  traceOf: (span: ReadableSpan | undefined) => ReadableSpan[];
} {
  const exporter = new InMemorySpanExporter();
  let tracing: Tracing | undefined;
  beforeAll(() => {
    tracing = startTracing(exporter, { batch: false });
  });
  afterAll(async () => {
    await tracing?.shutdown();
  });
  beforeEach(() => {
    exporter.reset();
  });
  const spans = () => exporter.getFinishedSpans();
  return {
    spans,
    traceOf: (span) => {
      if (!span) throw new Error('no span');
      return spans().filter((other) => other.spanContext().traceId === span.spanContext().traceId);
    },
  };
}

/** The span [child] hangs from: [parent] itself. */
export function isChildOf(child: ReadableSpan | undefined, parent: ReadableSpan | undefined) {
  return (
    child !== undefined &&
    parent !== undefined &&
    child.parentSpanContext?.spanId === parent.spanContext().spanId &&
    child.spanContext().traceId === parent.spanContext().traceId
  );
}

/** A `traceparent` as a partner sends it (W3C Trace Context). */
export const PARTNER_TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
export const PARTNER_SPAN_ID = '00f067aa0ba902b7';
export const PARTNER_TRACEPARENT = `00-${PARTNER_TRACE_ID}-${PARTNER_SPAN_ID}-01`;
