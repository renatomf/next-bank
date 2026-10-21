import { STATUS_CODES } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ErrorReporter } from '../application/ports.ts';
import { DomainError } from '../domain/domain-error.ts';
import { MoneySchema } from './money.ts';

export interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
  /** Error name from the catalog (domain-model.md, section 9): what the app reacts to. */
  code?: string;
  /** Attempts left after a wrong PIN (PinIncorrect). */
  remainingAttempts?: number;
  /** The limit in force (LimitExceeded, TopUpLimitExceeded). */
  limit?: { amount: number; currency: 'BRL' };
  /** What is left of the limit today (TopUpLimitExceeded). */
  remaining?: { amount: number; currency: 'BRL' };
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const ProblemSchema = z
  .object({
    type: z.literal('about:blank'),
    title: z.string(),
    status: z.int(),
    code: z.string().optional(),
    remainingAttempts: z.int().min(0).optional(),
    limit: MoneySchema.optional(),
    remaining: MoneySchema.optional(),
  })
  .meta({ id: 'Problem' });

/**
 * HTTP status of each catalog error (domain-model.md, section 9). A domain error
 * missing here is a bug and answers 500, so the catalog cannot drift silently.
 */
const CATALOG_STATUS: Readonly<Record<string, number>> = {
  InvalidCpf: 422,
  WeakPassword: 422,
  InvalidPin: 422,
  AlreadyRegistered: 409,
  SessionExpired: 401,
  RefreshTokenReuseDetected: 401,
  Unauthenticated: 401,
  InvalidCredentials: 401,
  // 422, not 401: the caller is signed in, and a 401 would sign them out.
  PasswordIncorrect: 422,
  TooManyAttempts: 429,
  DemoAccountRestricted: 403,
  PinIncorrect: 422,
  PinNotCreated: 409,
  PinLocked: 423,
  PinResetRequired: 423,
  PinAlreadyCreated: 409,
  // A malformed value only a handler can check, such as a statement cursor.
  InvalidRequest: 422,
  NotFound: 404,
  PixKeyNotFound: 404,
  InvalidAmount: 422,
  SamePayerAndPayee: 422,
  InsufficientFunds: 422,
  LimitExceeded: 422,
  AccountBlocked: 422,
  IdempotencyKeyReused: 422,
  RequestInProgress: 409,
  InvalidTransferState: 409,
  TransferExpired: 409,
  InvalidPhoneNumber: 422,
  UnknownTopUpOperator: 422,
  InvalidTopUpAmount: 422,
  TopUpLimitExceeded: 422,
};

/** Generic RFC 9457 response: never carries stack, SQL or internal detail (API-03). */
export function problem(
  status: number,
  code?: string,
  details: Readonly<Record<string, number>> = {},
): Problem {
  const body: Problem = { type: 'about:blank', title: STATUS_CODES[status] ?? 'Error', status };
  if (code !== undefined) body.code = code;
  // Only fields the contract declares: a detail never leaks by accident.
  if (details.remainingAttempts !== undefined) body.remainingAttempts = details.remainingAttempts;
  if (details.limitCents !== undefined)
    body.limit = { amount: details.limitCents, currency: 'BRL' };
  if (details.remainingCents !== undefined)
    body.remaining = { amount: details.remainingCents, currency: 'BRL' };
  return body;
}

interface Classified {
  status: number;
  code?: string;
  details?: Readonly<Record<string, number>>;
}

function classify(error: unknown): Classified {
  if (error instanceof DomainError) {
    const status = CATALOG_STATUS[error.code];
    return status === undefined
      ? { status: 500 }
      : { status, code: error.code, details: error.details };
  }
  if (isValidationError(error)) return { status: 422, code: 'InvalidRequest' };
  const status = clientErrorStatus(error);
  if (status === 429) return { status, code: 'TooManyAttempts' };
  return { status: status ?? 500 };
}

/** Schema validation failure (body, query, params or headers). */
function isValidationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'validation' in error;
}

/** 4xx status set by Fastify or a plugin (body too large, rate limit...); anything else is 500. */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

export function registerProblemHandlers(app: FastifyInstance, reporter: ErrorReporter): void {
  app.setErrorHandler((error, request, reply) => {
    const { status, code, details } = classify(error);
    if (status >= 500) {
      request.log.error({ err: error }, 'unexpected error');
      // Only the unexpected: a refusal from the catalog is the API working.
      reporter.report(error, {
        requestId: request.id,
        method: request.method,
        route: request.routeOptions.url ?? 'unknown',
      });
    } else {
      request.log.info({ err: error }, 'request rejected');
    }
    return reply
      .status(status)
      .type(PROBLEM_CONTENT_TYPE)
      .send(problem(status, code, details));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).type(PROBLEM_CONTENT_TYPE).send(problem(404)),
  );
}
