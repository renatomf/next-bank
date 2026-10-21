import * as Sentry from '@sentry/node';
import type { ErrorReporter, ReportedRequest } from '../application/ports.ts';
import { SENSITIVE_KEYS } from '../logging.ts';

type Event = Sentry.ErrorEvent;

const REDACTED = '[REDACTED]';
const SENSITIVE = new Set(SENSITIVE_KEYS.map((key) => key.toLowerCase()));
// A CPF with or without its mask, as a visitor would type it.
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
// A mobile number with or without its mask, as on a top-up (MOB-02): (11) 90000-0001.
const PHONE = /\(?\b\d{2}\)?[\s-]?9\d{4}-?\d{4}\b/g;

/**
 * What leaves for Sentry (week 8 plan, PR c): no request body, cookies,
 * credentials or user, the same keys the logs redact (API-04), and nothing
 * shaped like a CPF or a phone number (LGPD). URLs leave without their query string, as in the
 * request log (READ-06): it can carry a searched name or a statement cursor.
 * A pure function, so it is tested on its own.
 */
export function scrubEvent<T extends Partial<Event>>(event: T): T {
  const scrubbed = { ...event };
  delete scrubbed.user;
  if (scrubbed.request) {
    const { url, method, headers } = scrubbed.request;
    scrubbed.request = {
      ...(url !== undefined ? { url: withoutQuery(url) } : {}),
      ...(method !== undefined ? { method } : {}),
      ...(headers ? { headers: redact(headers) as Record<string, string> } : {}),
    };
  }
  if (scrubbed.extra) scrubbed.extra = redact(scrubbed.extra) as typeof scrubbed.extra;
  if (scrubbed.contexts) {
    scrubbed.contexts = redact(scrubbed.contexts) as typeof scrubbed.contexts;
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.message !== undefined ? { message: maskPersonalNumbers(crumb.message) } : {}),
      ...(crumb.data ? { data: scrubCrumbData(crumb.data) } : {}),
    }));
  }
  if (scrubbed.message !== undefined) scrubbed.message = maskPersonalNumbers(scrubbed.message);
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) => ({
        ...value,
        ...(value.value !== undefined ? { value: maskPersonalNumbers(value.value) } : {}),
      })),
    };
  }
  return scrubbed;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? maskPersonalNumbers(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, inner]) => {
      // Credentials headers go entirely; other sensitive keys keep a marker.
      if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') return [];
      return [[key, SENSITIVE.has(key.toLowerCase()) ? REDACTED : redact(inner)]];
    }),
  );
}

/** A breadcrumb's data redacted, an HTTP breadcrumb's URL without its query. */
function scrubCrumbData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted = redact(data) as Record<string, unknown>;
  return typeof redacted.url === 'string'
    ? { ...redacted, url: withoutQuery(redacted.url) }
    : redacted;
}

/** The URL up to its query string or fragment. */
function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? url;
}

function maskPersonalNumbers(text: string): string {
  return text.replace(CPF, '[CPF]').replace(PHONE, '[PHONE]');
}

/** Sentry, set up once per process: errors only, no tracing, no personal data. */
export class SentryErrorReporter implements ErrorReporter {
  constructor(options: { dsn: string; environment: string; release?: string }) {
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment,
      ...(options.release ? { release: options.release } : {}),
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
      beforeBreadcrumb: (crumb) => scrubEvent({ breadcrumbs: [crumb] }).breadcrumbs[0] ?? null,
    });
  }

  report(error: unknown, request: ReportedRequest): void {
    Sentry.withScope((scope) => {
      scope.setTag('requestId', request.requestId);
      scope.setTag('route', `${request.method} ${request.route}`);
      Sentry.captureException(error);
    });
  }
}

/** Where no DSN is set (local development, tests): errors stay in the logs. */
export class NoopErrorReporter implements ErrorReporter {
  report(): void {
    // The log already has the error; nothing else to tell.
  }
}
