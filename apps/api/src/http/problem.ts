import { STATUS_CODES } from 'node:http';
import type { FastifyInstance } from 'fastify';

export interface Problem {
  type: 'about:blank';
  title: string;
  status: number;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Resposta RFC 9457 genérica: nunca carrega stack, SQL ou detalhe interno (API-03). */
export function problem(status: number): Problem {
  return { type: 'about:blank', title: STATUS_CODES[status] ?? 'Error', status };
}

/** Status 4xx que o Fastify atribui (corpo grande, validação etc.); qualquer outro erro vira 500. */
function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

export function registerProblemHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const status = clientErrorStatus(error) ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'erro inesperado');
    } else {
      request.log.info({ err: error }, 'requisição recusada');
    }
    return reply.status(status).type(PROBLEM_CONTENT_TYPE).send(problem(status));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).type(PROBLEM_CONTENT_TYPE).send(problem(404)),
  );
}
