import type { AuditTrail, Transaction } from '../../../shared/application/ports.ts';
import { pgClientOf } from '../../../shared/infrastructure/pg-unit-of-work.ts';
import { PgAuditTrail } from '../../audit/index.ts';
import type { AuditTrailFactory } from '../application/ports.ts';

/** The audit trail on the connection of the reader's transaction. */
export class PgAuditTrailFactory implements AuditTrailFactory {
  for(tx: Transaction): AuditTrail {
    return new PgAuditTrail(pgClientOf(tx));
  }
}
