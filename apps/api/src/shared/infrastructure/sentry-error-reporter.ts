import * as Sentry from '@sentry/node';
import type { ErrorReporter, ReportedRequest } from '../application/ports.ts';
import { SENSITIVE_KEYS } from '../logging.ts';

type Event = Sentry.ErrorEvent;

const REDACTED = '[REDACTED]';
const SENSITIVE = new Set(SENSITIVE_KEYS.map((key) => key.toLowerCase()));
// A CPF with or without its mask, as a visitor would type it.
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

/**
 * What leaves for Sentry (week 8 plan, PR c): no request body, cookies,
 * credentials or user, the same keys the logs redact (API-04), and nothing
 * shaped like a CPF (LGPD). A pure function, so it is tested on its own.
 */
export function scrubEvent<T extends Partial<Event>>(event: T): T {
  const scrubbed = { ...event };
  delete scrubbed.user;
  if (scrubbed.request) {
    const { url, method, headers } = scrubbed.request;
    scrubbed.request = {
      ...(url !== undefined ? { url } : {}),
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
      ...(crumb.message !== undefined ? { message: maskCpf(crumb.message) } : {}),
      ...(crumb.data ? { data: redact(crumb.data) as Record<string, unknown> } : {}),
    }));
  }
  if (scrubbed.message !== undefined) scrubbed.message = maskCpf(scrubbed.message);
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) => ({
        ...value,
        ...(value.value !== undefined ? { value: maskCpf(value.value) } : {}),
      })),
    };
  }
  return scrubbed;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' ? maskCpf(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, inner]) => {
      // Credentials headers go entirely; other sensitive keys keep a marker.
      if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') return [];
      return [[key, SENSITIVE.has(key.toLowerCase()) ? REDACTED : redact(inner)]];
    }),
  );
}

function maskCpf(text: string): string {
  return text.replace(CPF, '[CPF]');
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
