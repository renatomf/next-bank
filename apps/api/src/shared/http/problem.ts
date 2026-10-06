import { STATUS_CODES } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError } from '../domain/domain-error.ts';

export interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
  /** Error name from the catalog (domain-model.md, section 9): what the app reacts to. */
  code?: string;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const ProblemSchema = z
  .object({
    type: z.literal('about:blank'),
    title: z.string(),
    status: z.int(),
    code: z.string().optional(),
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
  PinLocked: 423,
  PinResetRequired: 423,
};

/** Generic RFC 9457 response: never carries stack, SQL or internal detail (API-03). */
export function problem(status: number, code?: string): Problem {
  const body: Problem = { type: 'about:blank', title: STATUS_CODES[status] ?? 'Error', status };
  if (code !== undefined) body.code = code;
  return body;
}

function classify(error: unknown): { status: number; code?: string } {
  if (error instanceof DomainError) {
    const status = CATALOG_STATUS[error.code];
    return status === undefined ? { status: 500 } : { status, code: error.code };
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

export function registerProblemHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const { status, code } = classify(error);
    if (status >= 500) {
      request.log.error({ err: error }, 'unexpected error');
    } else {
      request.log.info({ err: error }, 'request rejected');
    }
    return reply.status(status).type(PROBLEM_CONTENT_TYPE).send(problem(status, code));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).type(PROBLEM_CONTENT_TYPE).send(problem(404)),
  );
}
