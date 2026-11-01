import type { Attributes } from '@opentelemetry/api';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-node';

/**
 * What a span may carry (v1.2.0 plan, task 8; EXT-07): ids, states and the
 * route's template. Never a URL, a body, a Pix key, a name, a document or an
 * amount: following a Pix along its way needs none of them.
 */
const ALLOWED = new Set([
  'http.request.method',
  'http.route',
  'http.response.status_code',
  'nextbank.request_id',
  'messaging.message.id',
  'nextbank.outbox.type',
  'nextbank.outbox.attempt',
  'nextbank.pix.transfer_id',
  'nextbank.pix.end_to_end_id',
  'nextbank.pix.status',
  'nextbank.schedule.id',
  // The error's class name only, as the outbox's last_error: its message may carry anything.
  'error.type',
]);

/** How an exporter is told the outcome of an export. */
type ResultCallback = Parameters<SpanExporter['export']>[1];

export function allowedAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(Object.entries(attributes).filter(([name]) => ALLOWED.has(name)));
}

/**
 * The span as it may leave the process: the allowed attributes only, no
 * events (an exception's message may carry anything) and the status without
 * its message. Everything else is read from the span as the SDK ended it.
 */
function onlyAllowed(span: ReadableSpan): ReadableSpan {
  return Object.create(span, {
    attributes: { value: allowedAttributes(span.attributes) },
    events: { value: [] },
    status: { value: { code: span.status.code } },
    links: {
      value: span.links.map((link) => ({ context: link.context, attributes: {} })),
    },
  }) as ReadableSpan;
}

/**
 * Filters every span before the exporter behind it sees it, whoever wrote
 * the span: the list decides, not each call site (EXT-07).
 */
export class AllowedAttributesExporter implements SpanExporter {
  readonly #inner: SpanExporter;

  constructor(inner: SpanExporter) {
    this.#inner = inner;
  }

  export(spans: ReadableSpan[], resultCallback: ResultCallback): void {
    this.#inner.export(spans.map(onlyAllowed), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.#inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.#inner.forceFlush?.() ?? Promise.resolve();
  }
}
