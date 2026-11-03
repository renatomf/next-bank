import type { Transaction } from '../../../shared/application/ports.ts';
import { NotFound } from '../../../shared/domain/not-found.ts';
import { recordAccess, scopeOf } from './customer-reads.ts';
import type {
  AuditFilter,
  AuditPosition,
  AuditReaderPort,
  AuditRecord,
  StaffReader,
} from './ports.ts';
import type { CommandDependencies } from './staff-commands.ts';

const PAGE_SIZE = 20;

/** The reading asked for: exactly one filter (STF-16). */
export type AuditQuery =
  | { by: 'CUSTOMER'; customerId: string }
  | { by: 'MEMBER'; memberId: string }
  | { by: 'REQUEST'; requestId: string };

/** An event as the staff reads it: only the staff named, a customer by id (H4). */
export interface AuditEntryView {
  id: string;
  occurredAt: string;
  actor: { type: AuditRecord['actorType']; id: string | null; name: string | null };
  action: string;
  subject: { type: string; id: string };
  requestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditPage {
  items: AuditEntryView[];
  next: AuditPosition | null;
}

export interface AuditTrailDependencies extends CommandDependencies {
  auditReader: AuditReaderPort;
}

/**
 * The audit trail read by the staff (v1.3.0 plan, task 8): who did what and
 * when, by customer, by member or by request, the newest first. Each filter
 * is checked against the reader's scope before anything is read (STF-11,
 * STF-16): what the reader may not see answers as missing. Reading a
 * customer's trail is itself recorded, in the same transaction (STF-07, H3).
 */
export class ReadAuditTrail {
  readonly #deps: AuditTrailDependencies;

  constructor(deps: AuditTrailDependencies) {
    this.#deps = deps;
  }

  execute(reader: StaffReader, query: AuditQuery, after: AuditPosition | null): Promise<AuditPage> {
    return this.#deps.unitOfWork.run(async (tx) => {
      const filter = await this.#filterFor(tx, reader, query);
      const found = await this.#deps.auditReader.eventsOf(tx, filter, after, PAGE_SIZE + 1);
      const page = found.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      const names = await this.#deps.staffNames.namesOf(tx, [
        ...new Set(
          page.flatMap((event) =>
            event.actorType === 'STAFF' && event.actorId ? [event.actorId] : [],
          ),
        ),
      ]);
      return {
        items: page.map((event) => ({
          id: event.id,
          occurredAt: event.occurredAt.toISOString(),
          actor: {
            type: event.actorType,
            id: event.actorId,
            name: event.actorType === 'STAFF' ? (names.get(event.actorId ?? '') ?? null) : null,
          },
          action: event.action,
          subject: { type: event.subjectType, id: event.subjectId },
          requestId: event.requestId,
          metadata: event.metadata,
        })),
        next:
          found.length > PAGE_SIZE && last ? { occurredAt: last.occurredAt, id: last.id } : null,
      };
    });
  }

  async #filterFor(tx: Transaction, reader: StaffReader, query: AuditQuery): Promise<AuditFilter> {
    switch (query.by) {
      case 'CUSTOMER': {
        const customer = await this.#deps.customers.find(tx, query.customerId, scopeOf(reader));
        if (!customer) throw new NotFound('Customer');
        await recordAccess(this.#deps, tx, reader, customer.id, 'AUDIT');
        return {
          by: 'CUSTOMER',
          customerId: customer.id,
          accountId: await this.#deps.accounts.accountIdOf(tx, customer.id),
        };
      }
      case 'MEMBER': {
        const member = await this.#deps.staffNames.memberOf(tx, query.memberId);
        if (!member || (reader.isDemo && !member.isDemo)) throw new NotFound('StaffMember');
        return query;
      }
      case 'REQUEST': {
        const request = await this.#deps.repositories.for(tx).requests.find(query.requestId);
        if (!request || (reader.isDemo && !request.demoScope)) throw new NotFound('Request');
        return query;
      }
    }
  }
}
