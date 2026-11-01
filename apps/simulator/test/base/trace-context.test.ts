import { propagation, ROOT_CONTEXT, trace, TraceFlags } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contextOf, traceparentOf } from '../../src/base/trace-context.ts';

// The participant's trace through the simulator (v1.2.0 plan, task 8): read
// from a context and opened from a stored traceparent, with the W3C
// propagator the process that mounts the simulator sets up.
const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const SPAN_ID = '00f067aa0ba902b7';
const TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`;

beforeAll(() => {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});
afterAll(() => {
  propagation.disable();
});

describe('traceparentOf', () => {
  it('writes the traceparent of the span in the context', () => {
    const context = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      traceFlags: TraceFlags.SAMPLED,
    });

    expect(traceparentOf(context)).toBe(TRACEPARENT);
  });

  it('is null where nothing is traced', () => {
    expect(traceparentOf(ROOT_CONTEXT)).toBeNull();
  });
});

describe('contextOf', () => {
  it('opens the context a stored traceparent names', () => {
    expect(trace.getSpanContext(contextOf(TRACEPARENT))).toMatchObject({
      traceId: TRACE_ID,
      spanId: SPAN_ID,
      isRemote: true,
    });
  });

  it.each([null, 'clara.aurora@example.com', TRACEPARENT.toUpperCase()])(
    'opens no context for %s',
    (traceparent) => {
      expect(contextOf(traceparent)).toBe(ROOT_CONTEXT);
    },
  );
});
