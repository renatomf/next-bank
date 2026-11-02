import 'server-only';
import { randomUUID } from 'node:crypto';
import createClient from 'openapi-fetch';
import type { components, paths } from './api-types';

type StaffMember = components['schemas']['StaffMember'];

/** The API refused a login; [code] is the catalog's (InvalidCredentials, TooManyAttempts). */
export class LoginRefused extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'LoginRefused';
    this.code = code;
  }
}

/** The API refused the session (ended, expired or revoked): the cookie goes too. */
export class SessionEnded extends Error {
  constructor() {
    super('The staff session ended');
    this.name = 'SessionEnded';
  }
}

export interface AdminApiOptions {
  baseUrl: string;
  /** BACKOFFICE_API_KEY: only this server has it (STF-08). */
  apiKey: string;
  /** The staff session's token, from the cookie; none before the login. */
  token?: string | undefined;
  fetch?: (input: Request) => Promise<Response>;
}

/**
 * The backoffice's client of the API's /admin routes (v1.3.0 plan, task 2;
 * B2, B8). Server only: the backoffice's key never reaches a browser, and
 * the build fails if this module is imported there. Every call carries a
 * request id of its own and is never cached, so one member's answer never
 * serves another.
 */
export function adminApi(options: AdminApiOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    cache: 'no-store',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const headers = () => ({
    'x-backoffice-key': options.apiKey,
    'x-request-id': randomUUID(),
    ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
  });

  return {
    async login(body: {
      email: string;
      password: string;
      mfaCode: string;
    }): Promise<{ token: string; expiresAt: Date }> {
      const { data, error, response } = await client.POST('/admin/v1/auth/login', {
        headers: headers(),
        body,
      });
      if (data === undefined) throw new LoginRefused(codeOf(error, response));
      return { token: data.token, expiresAt: new Date(data.expiresAt) };
    },

    async me(): Promise<StaffMember> {
      const { data, response } = await client.GET('/admin/v1/me', { headers: headers() });
      if (data === undefined) throw failureOf(response);
      return data;
    },

    async logout(): Promise<void> {
      const { response } = await client.POST('/admin/v1/auth/logout', { headers: headers() });
      if (!response.ok) throw failureOf(response);
    },
  };
}

function codeOf(error: unknown, response: Response): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return `HTTP ${String(response.status)}`;
}

function failureOf(response: Response): Error {
  return response.status === 401
    ? new SessionEnded()
    : new Error(`The API answered ${String(response.status)}`);
}
