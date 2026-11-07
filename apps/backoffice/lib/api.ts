import 'server-only';
import { randomUUID } from 'node:crypto';
import createClient from 'openapi-fetch';
import type { components, paths } from './api-types';

type StaffMember = components['schemas']['StaffMember'];
export type CustomerSearch = components['schemas']['CustomerSearch'];
export type CustomerCard = components['schemas']['CustomerCard'];
export type Statement = components['schemas']['Statement'];
export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type ApprovalRequestsPage = components['schemas']['ApprovalRequestsPage'];
export type Reason = ApprovalRequest['reason'];
export type ReconciliationException = components['schemas']['ReconciliationException'];
export type ReconciliationExceptionsPage = components['schemas']['ReconciliationExceptionsPage'];
export type Resolution = NonNullable<ApprovalRequest['exception']>['resolution'];
export type StaffMemberView = components['schemas']['StaffMemberView'];
export type StaffPage = components['schemas']['StaffPage'];
export type CreatedStaffMember = components['schemas']['CreatedStaffMember'];
export type ManagedRole = 'OPERATOR' | 'ANALYST';
export type AuditEntry = components['schemas']['AuditEntry'];
export type AuditPage = components['schemas']['AuditPage'];
/** The trail is read by exactly one of these (task 8, STF-16). */
export type AuditFilter = { customerId: string } | { memberId: string } | { requestId: string };

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

/**
 * The API refused a staff command; [code] is the catalog's (AccountAlreadyBlocked,
 * RequestNotPending, SelfApprovalNotAllowed, ...), shown to the member in words.
 */
export class CommandRefused extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'CommandRefused';
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

    // The staff's commands (v1.3.0 plan, task 4): each with the key its form
    // was rendered with (K6), so a repeated submission acts once.

    async blockAccount(customerId: string, reason: Reason, idempotencyKey: string): Promise<void> {
      const { error, response } = await client.POST('/admin/v1/customers/{customerId}/block', {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey }, path: { customerId } },
        body: { reason },
      });
      if (!response.ok) throw refusalOf(error, response);
    },

    async requestUnblock(
      customerId: string,
      reason: Reason,
      note: string | null,
      idempotencyKey: string,
    ): Promise<ApprovalRequest> {
      const { data, error, response } = await client.POST('/admin/v1/requests', {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey } },
        body: { kind: 'UNBLOCK_ACCOUNT', customerId, reason, note },
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    /** The reversal of a Pix, by its id: the amount is the Pix's own (task 5, PIX-14). */
    async requestReversal(
      transferId: string,
      reason: Reason,
      note: string | null,
      idempotencyKey: string,
    ): Promise<ApprovalRequest> {
      const { data, error, response } = await client.POST('/admin/v1/requests', {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey } },
        body: { kind: 'REVERSE_PIX', transferId, reason, note },
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    async decideRequest(
      requestId: string,
      decision: 'approve' | 'reject',
      note: string | null,
      idempotencyKey: string,
    ): Promise<ApprovalRequest> {
      const route =
        decision === 'approve'
          ? '/admin/v1/requests/{requestId}/approve'
          : '/admin/v1/requests/{requestId}/reject';
      const { data, error, response } = await client.POST(route, {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey }, path: { requestId } },
        body: { note },
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    async cancelRequest(requestId: string, idempotencyKey: string): Promise<ApprovalRequest> {
      const { data, error, response } = await client.POST('/admin/v1/requests/{requestId}/cancel', {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey }, path: { requestId } },
        body: {},
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    /** With mine, only what this member asked (home plan, H1). */
    async listRequests(
      status: 'PENDING' | 'ALL',
      cursor: string | null,
      options: { mine?: boolean } = {},
    ): Promise<ApprovalRequestsPage> {
      const { data, response } = await client.GET('/admin/v1/requests', {
        headers: headers(),
        params: {
          query: {
            status,
            ...(options.mine === true ? { mine: 'true' as const } : {}),
            ...(cursor === null ? {} : { cursor }),
          },
        },
      });
      if (data === undefined) throw failureOf(response);
      return data;
    },

    /** The request, or null when the API shows this member no such request. */
    async request(requestId: string): Promise<ApprovalRequest | null> {
      const { data, response } = await client.GET('/admin/v1/requests/{requestId}', {
        headers: headers(),
        params: { path: { requestId } },
      });
      return data ?? orNullWhenMissing(response);
    },

    // The reconciliation's exceptions (v1.3.0 plan, task 6).

    async listExceptions(
      status: 'OPEN' | 'ALL',
      cursor: string | null,
    ): Promise<ReconciliationExceptionsPage> {
      const { data, response } = await client.GET('/admin/v1/exceptions', {
        headers: headers(),
        params: { query: cursor === null ? { status } : { status, cursor } },
      });
      if (data === undefined) throw failureOf(response);
      return data;
    },

    /** The exception, or null when the API shows this member no such exception. */
    async exception(exceptionId: string): Promise<ReconciliationException | null> {
      const { data, response } = await client.GET('/admin/v1/exceptions/{exceptionId}', {
        headers: headers(),
        params: { path: { exceptionId } },
      });
      return data ?? orNullWhenMissing(response);
    },

    /** Settling or refunding a Pix left waiting: someone else approves it (X3). */
    async requestResolution(
      exceptionId: string,
      resolution: Resolution,
      reason: Reason,
      note: string | null,
      idempotencyKey: string,
    ): Promise<ApprovalRequest> {
      const { data, error, response } = await client.POST('/admin/v1/requests', {
        headers: headers(),
        params: { header: { 'idempotency-key': idempotencyKey } },
        body: { kind: 'RESOLVE_EXCEPTION', exceptionId, resolution, reason, note },
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    /** The audit trail by one filter, or null when the API shows this member none (task 8). */
    async auditTrail(filter: AuditFilter, cursor: string | null): Promise<AuditPage | null> {
      const { data, response } = await client.GET('/admin/v1/audit', {
        headers: headers(),
        params: { query: cursor === null ? filter : { ...filter, cursor } },
      });
      return data ?? orNullWhenMissing(response);
    },

    // The staff management, by the admin (v1.3.0 plan, task 7).

    async listStaff(cursor: string | null): Promise<StaffPage> {
      const { data, response } = await client.GET('/admin/v1/staff', {
        headers: headers(),
        params: { query: cursor === null ? {} : { cursor } },
      });
      if (data === undefined) throw failureOf(response);
      return data;
    },

    /** The credentials come in this answer only (G5, STF-15): shown once, never kept. */
    async createStaffMember(body: {
      name: string;
      email: string;
      role: ManagedRole;
    }): Promise<CreatedStaffMember> {
      const { data, error, response } = await client.POST('/admin/v1/staff', {
        headers: headers(),
        body,
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    async changeStaffRole(memberId: string, role: ManagedRole): Promise<StaffMemberView> {
      const { data, error, response } = await client.POST('/admin/v1/staff/{memberId}/role', {
        headers: headers(),
        params: { path: { memberId } },
        body: { role },
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    async disableStaffMember(memberId: string): Promise<StaffMemberView> {
      const { data, error, response } = await client.POST('/admin/v1/staff/{memberId}/disable', {
        headers: headers(),
        params: { path: { memberId } },
        body: {},
      });
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },

    /** An exception that needs nothing more, by the analyst alone (X2). */
    async explainException(
      exceptionId: string,
      explanation: string,
      idempotencyKey: string,
    ): Promise<ReconciliationException> {
      const { data, error, response } = await client.POST(
        '/admin/v1/exceptions/{exceptionId}/explain',
        {
          headers: headers(),
          params: { header: { 'idempotency-key': idempotencyKey }, path: { exceptionId } },
          body: { explanation },
        },
      );
      if (data === undefined) throw refusalOf(error, response);
      return data;
    },
  };
}

/** A refused command keeps its catalog code; a lost session still ends here. */
function refusalOf(error: unknown, response: Response): Error {
  if (response.status === 401) return new SessionEnded();
  if ([403, 404, 409, 422].includes(response.status)) {
    return new CommandRefused(codeOf(error, response));
  }
  return failureOf(response);
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
