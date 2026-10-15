import type { FastifyRequest } from 'fastify';

// Personal data and secrets never reach the log (API-04).
export const SENSITIVE_KEYS = [
  'password',
  'pin',
  // The PIN and password changes (F-25).
  'currentPassword',
  'newPassword',
  'newPin',
  'cpf',
  'pixKey',
  // The value of a Pix key looked up or paid (a CPF, an e-mail...).
  'value',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  // Personal data: never in logs (database.md, section 2). Error class names stay in err.type.
  'email',
  'name',
];

export const REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]);

/**
 * The request as logged, with the fields of Fastify's default serializer
 * but the path without its query string, which can carry a searched name
 * or a statement cursor (READ-06).
 */
export function requestForLog(request: FastifyRequest): {
  method: string;
  url: string;
  hostname: string;
  remoteAddress: string;
} {
  return {
    method: request.method,
    url: request.url.split('?', 1)[0] ?? '',
    hostname: request.hostname,
    remoteAddress: request.ip,
  };
}
