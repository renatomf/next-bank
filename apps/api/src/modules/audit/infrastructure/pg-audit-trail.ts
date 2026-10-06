import type pg from 'pg';
import type { AuditEvent, AuditTrail } from '../../../shared/application/ports.ts';

/** Writes on the caller's connection, so the event commits or rolls back with the operation. */
export class PgAuditTrail implements AuditTrail {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async record(event: AuditEvent): Promise<void> {
    await this.#client.query(
      `INSERT INTO audit.audit_events
         (id, occurred_at, actor_type, actor_id, action, subject_type, subject_id, request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.id,
        event.occurredAt,
        event.actorType,
        event.actorId,
        event.action,
        event.subjectType,
        event.subjectId,
        event.requestId,
        event.metadata,
      ],
    );
  }
}
