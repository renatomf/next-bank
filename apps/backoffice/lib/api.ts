import 'server-only';
import { randomUUID } from 'node:crypto';
import createClient from 'openapi-fetch';
import type { components, paths } from './api-types';

type StaffMember = components['schemas']['StaffMember'];
export type CustomerSearch = components['schemas']['CustomerSearch'];
export type CustomerCard = components['schemas']['CustomerCard'];
export type Statement = components['schemas']['Statement'];

/** The API refused a login; [code] is the catalog's (InvalidCredentials, TooManyAttempts). */
export class LoginRefused extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'LoginRefused';
    this.code = code;
  }
}

/** The API refused a search term; [code] is the catalog's (InvalidRequest, InvalidCpf). */
export class SearchRefused extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'SearchRefused';
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

    /** By POST: the term (a CPF, an e-mail) never sits in a URL (task 3, C2). */
    async searchCustomers(query: string): Promise<CustomerSearch> {
      const { data, error, response } = await client.POST('/admin/v1/customers/search', {
        headers: headers(),
        body: { query },
      });
      if (data !== undefined) return data;
      if (response.status === 422) throw new SearchRefused(codeOf(error, response));
      throw failureOf(response);
    },

    /** The card, or null when the API shows this member no such customer. */
    async customer(customerId: string): Promise<CustomerCard | null> {
      const { data, response } = await client.GET('/admin/v1/customers/{customerId}', {
        headers: headers(),
        params: { path: { customerId } },
      });
      return data ?? orNullWhenMissing(response);
    },

    async customerStatement(customerId: string, cursor: string | null): Promise<Statement | null> {
      const { data, response } = await client.GET('/admin/v1/customers/{customerId}/statement', {
        headers: headers(),
        params: { path: { customerId }, query: cursor === null ? {} : { cursor } },
      });
      return data ?? orNullWhenMissing(response);
    },
  };
}

function codeOf(error: unknown, response: Response): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return `HTTP ${String(response.status)}`;
}

function orNullWhenMissing(response: Response): null {
  if (response.status === 404 || response.status === 422) return null;
  throw failureOf(response);
}

function failureOf(response: Response): Error {
  return response.status === 401
    ? new SessionEnded()
    : new Error(`The API answered ${String(response.status)}`);
}
