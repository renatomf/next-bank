import {
  type Attributes,
  type Context,
  context,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-node';
import { AllowedAttributesExporter } from './allowed-span-attributes.ts';

/**
 * The end-to-end trace (v1.2.0 plan, task 8). This module is the one owner
 * of the OpenTelemetry setup in the process (T2): Sentry skips its own. When
 * it is not started, as in production without an endpoint (T5), the spans
 * below are the API's no-op ones and cost nothing.
 */

/** W3C Trace Context, version 00, lower case only (API-10). */
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

export interface Tracing {
  /** Sends what is left and stops tracing in the process. */
  shutdown(): Promise<void>;
}

/**
 * Registers the tracer provider for the whole process. Every span goes
 * through the filter of the allowed attributes before [exporter] sees it
 * (EXT-07); in batches, so a slow collector never holds a request.
 */
export function startTracing(exporter: SpanExporter, options = { batch: true }): Tracing {
  const filtered = new AllowedAttributesExporter(exporter);
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': 'nextbank-api' }),
    spanProcessors: [
      options.batch ? new BatchSpanProcessor(filtered) : new SimpleSpanProcessor(filtered),
    ],
  });
  provider.register();
  return {
    shutdown: async () => {
      await provider.shutdown();
      trace.disable();
      context.disable();
      propagation.disable();
    },
  };
}

/** The exporter to an OTLP/HTTP collector, such as the local Jaeger (T6). */
export function otlpExporter(endpoint: string): SpanExporter {
  return new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` });
}

const tracer = () => trace.getTracer('nextbank-api');

/**
 * The context a `traceparent` names, or none when it is missing or out of
 * format. Only the `traceparent` is read: nothing else a sender puts in its
 * headers reaches the trace.
 */
export function contextOf(traceparent: unknown): Context {
  if (typeof traceparent !== 'string' || !TRACEPARENT.test(traceparent)) return ROOT_CONTEXT;
  return propagation.extract(ROOT_CONTEXT, { traceparent });
}

/** The `traceparent` of the span running now, or null when nothing is traced. */
export function activeTraceparent(): string | null {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const traceparent = carrier.traceparent;
  return traceparent !== undefined && TRACEPARENT.test(traceparent) ? traceparent : null;
}

/** The `traceparent` header for a call made from the span running now. */
export function traceHeaders(): Record<string, string> {
  const traceparent = activeTraceparent();
  return traceparent ? { traceparent } : {};
}

/** Adds to the span running now; the filter decides what leaves (EXT-07). */
export function annotate(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
}

/** Marks [span] as failed with the error's class name only: its message may carry anything. */
export function markFailed(span: Span, error: unknown): void {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.setAttribute('error.type', error instanceof Error ? error.name : 'Error');
}

/**
 * Runs [work] in a span of its own, active while it runs, so what it calls
 * hangs from it. The span ends with the work, failed if the work throws.
 */
export function inSpan<T>(
  name: string,
  options: { parent?: Context; kind?: SpanKind; attributes?: Attributes },
  work: () => Promise<T>,
): Promise<T> {
  const parent = options.parent ?? context.active();
  return tracer().startActiveSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      ...(options.attributes ? { attributes: options.attributes } : {}),
    },
    parent,
    async (span) => {
      try {
        return await work();
      } catch (error) {
        markFailed(span, error);
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

/** A round of a worker of the server: a trace of its own, with what it does under it. */
export function inRootSpan<T>(name: string, work: () => Promise<T>): Promise<T> {
  return inSpan(name, { parent: ROOT_CONTEXT }, work);
}
