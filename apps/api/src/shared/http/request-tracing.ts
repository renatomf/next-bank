import {
  type Context,
  context,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { contextOf } from '../infrastructure/tracing.ts';
import { isPartnerRoute } from './partner-routes.ts';

/**
 * A span per request (v1.2.0 plan, task 8), named by the route's template,
 * never by its path, which may carry a Pix key or a searched name (API-04,
 * READ-06). Only a partner continues a trace of its own: the SPI on its
 * webhook and the API itself on the mounted simulator. A request of the app
 * always starts a new trace, tied to the app by its request id (EXT-10, T4).
 */
export function registerRequestTracing(app: FastifyInstance): void {
  const traced = new WeakMap<FastifyRequest, Context>();
  const tracer = trace.getTracer('nextbank-api');

  app.addHook('onRequest', (request, _reply, done) => {
    const route = request.routeOptions.url;
    const parent =
      route !== undefined && isPartnerRoute(route)
        ? contextOf(request.headers.traceparent)
        : ROOT_CONTEXT;
    const span = tracer.startSpan(
      route === undefined ? request.method : `${request.method} ${route}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': request.method,
          ...(route === undefined ? {} : { 'http.route': route }),
          'nextbank.request_id': request.id,
        },
      },
      parent,
    );
    traced.set(request, trace.setSpan(parent, span));
    done();
  });

  // The handler runs inside the request's span, so the transactions it
  // opens and the calls it makes hang from it.
  app.addHook('onRoute', (route) => {
    const handler = route.handler;
    route.handler = function (request, reply) {
      const active = traced.get(request);
      return active === undefined
        ? handler.call(this, request, reply)
        : context.with(active, () => handler.call(this, request, reply));
    };
  });

  app.addHook('onResponse', (request, reply, done) => {
    const span = trace.getSpan(traced.get(request) ?? ROOT_CONTEXT);
    if (span) {
      span.setAttribute('http.response.status_code', reply.statusCode);
      if (reply.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    }
    done();
  });
}
