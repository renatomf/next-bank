import type { Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';

/** Which events a reading of the trail asks for: exactly one of the three (STF-16). */
export type TrailFilter =
  | { by: 'CUSTOMER'; customerId: string; accountId: string | null }
  | { by: 'MEMBER'; memberId: string }
  | { by: 'REQUEST'; requestId: string };

/** An event as stored, read back for the staff (v1.3.0, task 8). */
export interface StoredAuditEvent {
  id: string;
  occurredAt: Date;
  actorType: 'USER' | 'SYSTEM' | 'STAFF';
  actorId: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

interface EventRow {
  id: string;
  occurred_at: Date;
  actor_type: StoredAuditEvent['actorType'];
  actor_id: string | null;
  action: string;
  subject_type: string;
  subject_id: string;
  request_id: string | null;
  metadata: Record<string, unknown>;
}

const COLUMNS = `id, occurred_at, actor_type, actor_id, action, subject_type, subject_id,
  request_id, metadata`;

/** Strictly before the last event of the page before, if any: $a its time, $b its id. */
const before = (a: number, b: number) =>
  `($${String(a)}::timestamptz IS NULL OR (occurred_at, id) < ($${String(a)}, $${String(b)}::uuid))`;

const NEWEST_FIRST = 'ORDER BY occurred_at DESC, id DESC';

/**
 * The audit trail read back for the staff (v1.3.0 plan, task 8), newest first,
 * a page at a time, each filter served by its indexes. The trail itself is
 * only ever inserted into (STF-10); this only reads.
 */
export class PgAuditReader {
  /** Served by audit_events_actor_idx. */
  static readonly MEMBER_SQL = `SELECT ${COLUMNS} FROM audit.audit_events
    WHERE actor_id = $1 AND actor_type = 'STAFF' AND ${before(2, 3)}
    ${NEWEST_FIRST} LIMIT $4`;

  /**
   * What the customer did, and what happened to them or to their account:
   * three index scans, each cut at the page's size, merged.
   */
  static readonly CUSTOMER_SQL = `SELECT ${COLUMNS} FROM (
      (SELECT ${COLUMNS} FROM audit.audit_events
        WHERE actor_id = $1 AND actor_type = 'USER' AND ${before(3, 4)}
        ${NEWEST_FIRST} LIMIT $5)
      UNION
      (SELECT ${COLUMNS} FROM audit.audit_events
        WHERE subject_type = 'USER' AND subject_id = $1 AND ${before(3, 4)}
        ${NEWEST_FIRST} LIMIT $5)
      UNION
      (SELECT ${COLUMNS} FROM audit.audit_events
        WHERE subject_type = 'ACCOUNT' AND subject_id = $2::uuid AND ${before(3, 4)}
        ${NEWEST_FIRST} LIMIT $5)
    ) events ${NEWEST_FIRST} LIMIT $5`;

  /**
   * The request itself, and the events that cite it (H5): served by
   * audit_events_subject_idx and audit_events_approval_request_idx.
   */
  static readonly REQUEST_SQL = `SELECT ${COLUMNS} FROM (
      (SELECT ${COLUMNS} FROM audit.audit_events
        WHERE subject_type = 'APPROVAL_REQUEST' AND subject_id = $1::text::uuid
          AND ${before(2, 3)}
        ${NEWEST_FIRST} LIMIT $4)
      UNION
      (SELECT ${COLUMNS} FROM audit.audit_events
        WHERE metadata ? 'approvalRequestId' AND metadata ->> 'approvalRequestId' = $1::text
          AND ${before(2, 3)}
        ${NEWEST_FIRST} LIMIT $4)
    ) events ${NEWEST_FIRST} LIMIT $4`;

  async eventsOf(
    tx: Transaction,
    filter: TrailFilter,
    after: { occurredAt: Date; id: string } | null,
    limit: number,
  ): Promise<StoredAuditEvent[]> {
    const position = [after?.occurredAt ?? null, after?.id ?? null];
    const [sql, params] = ((): [string, unknown[]] => {
      switch (filter.by) {
        case 'MEMBER':
          return [PgAuditReader.MEMBER_SQL, [filter.memberId, ...position, limit]];
        case 'CUSTOMER':
          return [
            PgAuditReader.CUSTOMER_SQL,
            [filter.customerId, filter.accountId, ...position, limit],
          ];
        case 'REQUEST':
          return [PgAuditReader.REQUEST_SQL, [filter.requestId, ...position, limit]];
      }
    })();
    const { rows } = await pgClientOf(tx).query<EventRow>(sql, params);
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      actorType: row.actor_type,
      actorId: row.actor_id,
      action: row.action,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      requestId: row.request_id,
      metadata: row.metadata,
    }));
  }
}
