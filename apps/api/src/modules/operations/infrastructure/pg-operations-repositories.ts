import type pg from 'pg';
import type { Transaction } from '../../../shared/application/ports.ts';
import { PgIdempotencyRepository } from '../../../shared/infrastructure/pg-idempotency-repository.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type {
  OperationsRepositories,
  OperationsRepositoriesFactory,
  RequestPosition,
  RequestsRepository,
} from '../application/ports.ts';
import type {
  ApprovalRequestState,
  Decision,
  Reason,
  RequestKind,
} from '../domain/approval-request.ts';
import type { Resolution } from '../domain/reconciliation-exception.ts';

interface RequestRow {
  id: string;
  kind: RequestKind;
  customer_id: string;
  transfer_id: string | null;
  reason: Reason;
  note: string | null;
  requested_by: string;
  requested_at: Date;
  expires_at: Date;
  demo_scope: boolean;
  exception_id: string | null;
  resolution: Resolution | null;
  decision: Decision | null;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
}

const REQUEST_WITH_DECISION = `SELECT r.id, r.kind, r.customer_id, r.transfer_id, r.reason, r.note,
    r.requested_by,
    r.requested_at, r.expires_at, r.demo_scope, r.exception_id, r.resolution,
    d.decision, d.decided_by, d.decided_at, d.note AS decision_note
  FROM operations.requests r
  LEFT JOIN operations.decisions d ON d.request_id = r.id`;

export class PgRequestsRepository implements RequestsRepository {
  /**
   * Newest first, from a position, pending only or all; served by
   * requests_queue_idx. The demo staff sees the demo ones only (STF-11).
   */
  static readonly LIST_SQL = `${REQUEST_WITH_DECISION}
    WHERE ($1 = 'ALL' OR (d.request_id IS NULL AND r.expires_at > $2))
      AND (r.demo_scope OR NOT $3::boolean)
      AND ($4::timestamptz IS NULL OR (r.requested_at, r.id) < ($4, $5::uuid))
    ORDER BY r.requested_at DESC, r.id DESC
    LIMIT $6`;

  /** Served by requests_customer_idx and the decisions' primary key. */
  static readonly HAS_PENDING_SQL = `SELECT EXISTS (
      SELECT 1 FROM operations.requests r
      WHERE r.customer_id = $1 AND r.kind = $2 AND r.expires_at > $3
        AND NOT EXISTS (SELECT 1 FROM operations.decisions d WHERE d.request_id = r.id)
    ) AS pending`;

  /** Served by requests_exception_idx and the decisions' primary key. */
  static readonly PENDING_FOR_EXCEPTIONS_SQL = `SELECT r.exception_id, r.id
    FROM operations.requests r
    WHERE r.exception_id = ANY($1::uuid[]) AND r.expires_at > $2
      AND NOT EXISTS (SELECT 1 FROM operations.decisions d WHERE d.request_id = r.id)`;

  /** Served by requests_transfer_idx and the decisions' primary key. */
  static readonly HAS_PENDING_FOR_TRANSFER_SQL = `SELECT EXISTS (
      SELECT 1 FROM operations.requests r
      WHERE r.transfer_id = $1 AND r.expires_at > $2
        AND NOT EXISTS (SELECT 1 FROM operations.decisions d WHERE d.request_id = r.id)
    ) AS pending`;

  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(state: ApprovalRequestState): Promise<void> {
    await this.#client.query(
      `INSERT INTO operations.requests
         (id, kind, customer_id, transfer_id, reason, note, requested_by, requested_at,
          expires_at, demo_scope, exception_id, resolution)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        state.id,
        state.kind,
        state.customerId,
        state.transferId,
        state.reason,
        state.note,
        state.requestedBy,
        state.requestedAt,
        state.expiresAt,
        state.demoScope,
        state.exceptionId,
        state.resolution,
      ],
    );
  }

  /**
   * Served by the primary key. The request is locked first and read again
   * after: a lock that waited for another decision re-reads only the locked
   * row, so a decision joined in the same statement would still look empty
   * and the request still pending (STF-09).
   */
  async lock(id: string): Promise<ApprovalRequestState | null> {
    const { rowCount } = await this.#client.query(
      'SELECT id FROM operations.requests WHERE id = $1 FOR UPDATE',
      [id],
    );
    return rowCount === 0 ? null : this.find(id);
  }

  /** Served by the primary key. */
  async find(id: string): Promise<ApprovalRequestState | null> {
    const { rows } = await this.#client.query<RequestRow>(
      `${REQUEST_WITH_DECISION} WHERE r.id = $1`,
      [id],
    );
    return rows[0] ? stateOf(rows[0]) : null;
  }

  async insertDecision(state: ApprovalRequestState): Promise<void> {
    const { decision } = state;
    if (!decision) throw new Error(`Request ${state.id} has no decision to write`);
    await this.#client.query(
      `INSERT INTO operations.decisions
         (request_id, requested_by, decision, decided_by, decided_at, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        state.id,
        state.requestedBy,
        decision.decision,
        decision.decidedBy,
        decision.decidedAt,
        decision.note,
      ],
    );
  }

  async hasPending(customerId: string, kind: RequestKind, now: Date): Promise<boolean> {
    const { rows } = await this.#client.query<{ pending: boolean }>(
      PgRequestsRepository.HAS_PENDING_SQL,
      [customerId, kind, now],
    );
    return rows[0]?.pending ?? false;
  }

  async hasPendingForTransfer(transferId: string, now: Date): Promise<boolean> {
    const { rows } = await this.#client.query<{ pending: boolean }>(
      PgRequestsRepository.HAS_PENDING_FOR_TRANSFER_SQL,
      [transferId, now],
    );
    return rows[0]?.pending ?? false;
  }

  async pendingForExceptions(exceptionIds: string[], now: Date): Promise<Map<string, string>> {
    if (exceptionIds.length === 0) return new Map();
    const { rows } = await this.#client.query<{ exception_id: string; id: string }>(
      PgRequestsRepository.PENDING_FOR_EXCEPTIONS_SQL,
      [exceptionIds, now],
    );
    return new Map(rows.map((row) => [row.exception_id, row.id]));
  }

  async list(filter: {
    status: 'PENDING' | 'ALL';
    onlyDemo: boolean;
    now: Date;
    after: RequestPosition | null;
    limit: number;
  }): Promise<ApprovalRequestState[]> {
    const { rows } = await this.#client.query<RequestRow>(PgRequestsRepository.LIST_SQL, [
      filter.status,
      filter.now,
      filter.onlyDemo,
      filter.after?.requestedAt ?? null,
      filter.after?.id ?? null,
      filter.limit,
    ]);
    return rows.map(stateOf);
  }
}

function stateOf(row: RequestRow): ApprovalRequestState {
  return {
    id: row.id,
    kind: row.kind,
    customerId: row.customer_id,
    transferId: row.transfer_id,
    reason: row.reason,
    note: row.note,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    demoScope: row.demo_scope,
    exceptionId: row.exception_id,
    resolution: row.resolution,
    decision:
      row.decision && row.decided_by && row.decided_at
        ? {
            decision: row.decision,
            decidedBy: row.decided_by,
            decidedAt: row.decided_at,
            note: row.decision_note,
          }
        : null,
  };
}

/** The requests, the idempotency records and the audit trail on the shared transaction. */
export class PgOperationsRepositories implements OperationsRepositoriesFactory {
  for(tx: Transaction): OperationsRepositories {
    const client = pgClientOf(tx);
    return {
      requests: new PgRequestsRepository(client),
      idempotency: new PgIdempotencyRepository(client),
      audit: new PgAuditTrail(client),
    };
  }
}
