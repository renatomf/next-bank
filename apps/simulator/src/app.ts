import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { type SimulatorPluginOptions, simulatorPlugin } from './plugin.ts';

export interface SimulatorDependencies extends SimulatorPluginOptions {
  /** Logs one JSON line per request; off by default (tests). */
  logger?: boolean;
  /** Where the log lines go; stdout by default. Setting it turns the log on. */
  logStream?: { write(line: string): void };
}

/**
 * The simulator of the Bacen and the other partners (v1.2.0 plan, D13) as an
 * app of its own, for local development, CI and its tests. In production it
 * is the same plugin, mounted in the API's service (D2).
 */
export function buildSimulator(deps: SimulatorDependencies): FastifyInstance {
  const logged = deps.logger === true || deps.logStream !== undefined;
  const app = Fastify({
    logger: logged
      ? {
          level: 'info',
          serializers: { req: requestForLog },
          ...(deps.logStream ? { stream: deps.logStream } : {}),
        }
      : false,
    bodyLimit: 16 * 1024,
  });
  void app.register(simulatorPlugin, {
    pool: deps.pool,
    participantKey: deps.participantKey,
    faults: deps.faults,
  });
  return app;
}

/**
 * The request as logged: method, path and peer, never headers (the
 * participant's key travels in one). The key asked of the DICT is a Pix key,
 * personal data even when made up, so it is masked (API-04, MOB-02); a query
 * string is dropped, as in the API (READ-06). Mounted in the API, the API's
 * own request log does the same.
 */
function requestForLog(request: FastifyRequest) {
  const path = request.url.split(/[?#]/, 1)[0] ?? request.url;
  return {
    method: request.method,
    url: path.replace(/^\/dict\/keys\/[^/]+/, '/dict/keys/[REDACTED]'),
    remoteAddress: request.ip,
  };
}
