import { type Attributes, SpanStatusCode } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { describe, expect, it } from 'vitest';
import {
  AllowedAttributesExporter,
  allowedAttributes,
} from '../../../src/shared/infrastructure/allowed-span-attributes.ts';

// EXT-07: what a span carries is decided by a list, not by whoever wrote the
// span. Anything off the list is dropped before it leaves the process.
describe('allowedAttributes', () => {
  it('keeps the attributes on the list', () => {
    const attributes = {
      'http.request.method': 'POST',
      'http.route': '/v1/pix/transfers/:transferId/authorize',
      'http.response.status_code': 200,
      'nextbank.request_id': 'app-request-0001',
      'messaging.message.id': 'a-message',
      'nextbank.outbox.type': 'pix.send-external',
      'nextbank.outbox.attempt': 1,
      'nextbank.pix.transfer_id': 'a-transfer',
      'nextbank.pix.end_to_end_id': 'E99900001202611011200abcdefghijk',
      'nextbank.pix.status': 'COMPLETED',
      'nextbank.schedule.id': 'a-schedule',
      'error.type': 'TypeError',
    };

    expect(allowedAttributes(attributes)).toEqual(attributes);
  });

  it('drops everything else: URLs, statements, names, documents, keys and amounts', () => {
    expect(
      allowedAttributes({
        'http.route': '/simulator/dict/keys/:key',
        'url.full': 'http://127.0.0.1:3000/simulator/dict/keys/clara.aurora@example.com',
        'url.path': '/simulator/dict/keys/clara.aurora@example.com',
        'db.query.text': "SELECT * FROM identity.users WHERE email = 'a@b.c'",
        'nextbank.payee.name': 'Clara Aurora Teixeira',
        'nextbank.payer.cpf': '123.456.789-09',
        'nextbank.pix.amount': 8_000,
        'exception.message': 'key clara.aurora@example.com not found',
      }),
    ).toEqual({ 'http.route': '/simulator/dict/keys/:key' });
  });
});

/** A span as the SDK ends it, with an event and, when given, an error message. */
function finishedSpan(attributes: Attributes, errorMessage?: string): ReadableSpan {
  const memory = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(memory)] });
  const span = provider.getTracer('test').startSpan('POST /simulator/dict/keys/:key', {
    attributes,
  });
  span.addEvent('exception', { 'exception.message': 'the key clara.aurora@example.com' });
  if (errorMessage) span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
  span.end();
  const [finished] = memory.getFinishedSpans();
  if (!finished) throw new Error('the span did not end');
  return finished;
}

/** What reaches the exporter behind the filter. */
async function exportedThroughFilter(span: ReadableSpan): Promise<ReadableSpan | undefined> {
  const inner = new InMemorySpanExporter();
  await new Promise<void>((resolve) => {
    new AllowedAttributesExporter(inner).export([span], () => {
      resolve();
    });
  });
  return inner.getFinishedSpans()[0];
}

describe('AllowedAttributesExporter', () => {
  it('exports the span with the allowed attributes only', async () => {
    const span = finishedSpan({
      'http.route': '/simulator/dict/keys/:key',
      'url.path': '/simulator/dict/keys/a@b.c',
    });

    const exported = await exportedThroughFilter(span);

    expect(exported?.name).toBe('POST /simulator/dict/keys/:key');
    expect(exported?.attributes).toEqual({ 'http.route': '/simulator/dict/keys/:key' });
    expect(exported?.spanContext()).toEqual(span.spanContext());
    expect(exported?.parentSpanContext).toEqual(span.parentSpanContext);
  });

  it('drops the events and the status message, which may carry anything', async () => {
    const exported = await exportedThroughFilter(
      finishedSpan({}, 'no key clara.aurora@example.com'),
    );

    expect(exported?.events).toEqual([]);
    expect(exported?.status).toEqual({ code: SpanStatusCode.ERROR });
  });
});
