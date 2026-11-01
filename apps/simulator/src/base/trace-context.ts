import { type Context, context, propagation, ROOT_CONTEXT } from '@opentelemetry/api';

/**
 * The participant's trace through the simulator (v1.2.0 plan, task 8, T3).
 * Only the OpenTelemetry API: it does nothing unless the process that runs
 * the simulator set tracing up, as the API's service does with it mounted.
 */

/** W3C Trace Context, version 00, lower case only. */
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/** The `traceparent` of the span running now, or null when nothing is traced. */
export function activeTraceparent(): string | null {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const traceparent = carrier.traceparent;
  return traceparent !== undefined && TRACEPARENT.test(traceparent) ? traceparent : null;
}

/** The context a stored `traceparent` names, or none. */
export function contextOf(traceparent: string | null): Context {
  if (traceparent === null || !TRACEPARENT.test(traceparent)) return ROOT_CONTEXT;
  return propagation.extract(ROOT_CONTEXT, { traceparent });
}
