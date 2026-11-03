import type {
  AccountStatus,
  AccountStatusPort,
  AuditFilter,
  AuditPosition,
  AuditReaderPort,
  AuditRecord,
  CompletedPix,
  CustomerAccessPort,
  ExceptionPosition,
  PixReversalsPort,
  ReconciliationExceptionsPort,
  StalePixPort,
  PixTransfersPort,
  OperationsRepositories,
  OperationsRepositoriesFactory,
  RequestsRepository,
  StaffNamesPort,
} from '../../../../src/modules/operations/application/ports.ts';
import type { ApprovalRequestState } from '../../../../src/modules/operations/domain/approval-request.ts';
import type {
  ExceptionState,
  ResolutionState,
} from '../../../../src/modules/operations/domain/reconciliation-exception.ts';
import {
  AccountAlreadyBlocked,
  AccountNotBlocked,
} from '../../../../src/modules/operations/domain/errors.ts';
import type {
  ClaimResult,
  IdempotencyClaim,
  StoredResponse,
} from '../../../../src/shared/application/idempotency.ts';
import type { AuditEvent, Transaction } from '../../../../src/shared/application/ports.ts';
import { InMemoryBank } from './fakes.ts';

export { FakeFingerprint } from '../../payments/application/fakes.ts';

/**
 * The bank of the reads, plus what the staff's commands touch: the accounts'
 * status, the customers' access, the requests and the idempotency records,
 * all in memory, as Operations sees them through its ports.
 */
export class InMemoryOperationsBank
  extends InMemoryBank
  implements
    AccountStatusPort,
    CustomerAccessPort,
    StaffNamesPort,
    PixTransfersPort,
    PixReversalsPort,
    ReconciliationExceptionsPort,
    StalePixPort,
    AuditReaderPort
{
  /** Pix by id, as Payments keeps them; the account ids are the holders' here. */
  readonly pix = new Map<string, CompletedPix>();
  readonly reversed = new Set<string>();
  /** Balance each holder may still give back, in cents; absent means plenty. */
  readonly spendable = new Map<string, bigint>();

  // PixTransfersPort
  pixById(_tx: Transaction, transferId: string): Promise<CompletedPix | null> {
    return Promise.resolve(this.pix.get(transferId) ?? null);
  }

  pixByIds(_tx: Transaction, ids: string[]): Promise<CompletedPix[]> {
    return Promise.resolve(ids.flatMap((id) => this.pix.get(id) ?? []));
  }

  pixByEndToEndIds(_tx: Transaction, endToEndIds: string[]): Promise<CompletedPix[]> {
    return Promise.resolve(
      [...this.pix.values()].filter(
        (pix) => pix.endToEndId !== null && endToEndIds.includes(pix.endToEndId),
      ),
    );
  }

  /** The reconciliation's exceptions by id, each with its resolution once it has one. */
  readonly exceptions = new Map<string, ExceptionState>();
  /** The end-to-end ids of the Pix still waiting for the SPI. */
  readonly waiting = new Set<string>();
  /** What the staff concluded, as Payments would apply it. */
  readonly concluded: {
    endToEndId: string;
    outcome: 'SETTLED' | 'REJECTED';
    actorId: string;
    requestId: string | null;
    approvalRequestId: string;
  }[] = [];

  // ReconciliationExceptionsPort
  exceptionsPage(
    _tx: Transaction,
    filter: { status: 'OPEN' | 'ALL'; after: ExceptionPosition | null; limit: number },
  ): Promise<ExceptionState[]> {
    const { after } = filter;
    const newestFirst = [...this.exceptions.values()].sort(
      (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime() || b.id.localeCompare(a.id),
    );
    return Promise.resolve(
      newestFirst
        .filter((exception) => filter.status === 'ALL' || exception.resolution === null)
        .filter(
          (exception) =>
            after === null ||
            exception.detectedAt < after.detectedAt ||
            (exception.detectedAt.getTime() === after.detectedAt.getTime() &&
              exception.id < after.id),
        )
        .slice(0, filter.limit)
        .map((exception) => ({ ...exception })),
    );
  }

  exceptionById(_tx: Transaction, id: string): Promise<ExceptionState | null> {
    const exception = this.exceptions.get(id);
    return Promise.resolve(exception ? { ...exception } : null);
  }

  lockException(tx: Transaction, id: string): Promise<ExceptionState | null> {
    return this.exceptionById(tx, id);
  }

  recordResolution(_tx: Transaction, resolution: ResolutionState): Promise<void> {
    const exception = this.exceptions.get(resolution.exceptionId);
    if (!exception) return Promise.reject(new Error('resolutions_exception_id_fkey'));
    if (exception.resolution) return Promise.reject(new Error('resolutions_pkey'));
    this.exceptions.set(exception.id, { ...exception, resolution: { ...resolution } });
    return Promise.resolve();
  }

  // StalePixPort
  concludeWaitingPix(
    _tx: Transaction,
    input: {
      endToEndId: string;
      outcome: 'SETTLED' | 'REJECTED';
      actorId: string;
      requestId: string | null;
      approvalRequestId: string;
    },
  ): Promise<'APPLIED' | 'NOT_WAITING'> {
    if (!this.waiting.delete(input.endToEndId)) return Promise.resolve('NOT_WAITING');
    this.concluded.push({ ...input });
    return Promise.resolve('APPLIED');
  }

  // PixReversalsPort
  isReversed(_tx: Transaction, transferId: string): Promise<boolean> {
    return Promise.resolve(this.reversed.has(transferId));
  }

  reverse(
    _tx: Transaction,
    posting: { transferId: string; payeeAccountId: string; amount: { cents: bigint } },
  ): Promise<'REVERSED' | 'PAYEE_WITHOUT_FUNDS'> {
    const spendable = this.spendable.get(posting.payeeAccountId);
    if (spendable !== undefined && spendable < posting.amount.cents) {
      return Promise.resolve('PAYEE_WITHOUT_FUNDS');
    }
    this.reversed.add(posting.transferId);
    return Promise.resolve('REVERSED');
  }

  /** The audit trail as the staff reads it (task 8), apart from what the commands record. */
  readonly auditEvents: AuditRecord[] = [];
  /** Each member's name and whether it is the public demo's. */
  readonly staffMembers = new Map<string, { name: string; isDemo: boolean }>();

  // AuditReaderPort
  eventsOf(
    _tx: Transaction,
    filter: AuditFilter,
    after: AuditPosition | null,
    limit: number,
  ): Promise<AuditRecord[]> {
    const matches = (event: AuditRecord): boolean => {
      switch (filter.by) {
        case 'MEMBER':
          return (
            (event.actorType === 'STAFF' && event.actorId === filter.memberId) ||
            (event.subjectType === 'STAFF_MEMBER' && event.subjectId === filter.memberId)
          );
        case 'REQUEST':
          return (
            (event.subjectType === 'APPROVAL_REQUEST' && event.subjectId === filter.requestId) ||
            event.metadata.approvalRequestId === filter.requestId
          );
        case 'CUSTOMER':
          return (
            (event.actorType === 'USER' && event.actorId === filter.customerId) ||
            (event.subjectType === 'USER' && event.subjectId === filter.customerId) ||
            (event.subjectType === 'ACCOUNT' && event.subjectId === filter.accountId)
          );
      }
    };
    return Promise.resolve(
      this.auditEvents
        .filter(matches)
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))
        .filter(
          (event) =>
            after === null ||
            event.occurredAt < after.occurredAt ||
            (event.occurredAt.getTime() === after.occurredAt.getTime() && event.id < after.id),
        )
        .slice(0, limit),
    );
  }

  memberOf(_tx: Transaction, id: string): Promise<{ name: string; isDemo: boolean } | null> {
    return Promise.resolve(this.staffMembers.get(id) ?? null);
  }

  readonly statuses = new Map<string, AccountStatus>();
  readonly lockedOut = new Set<string>();
  readonly requests = new Map<string, ApprovalRequestState>();
  readonly staffNames = new Map<string, string>();
  readonly #records = new Map<string, IdempotencyClaim & { response: StoredResponse | null }>();

  // AccountStatusPort
  lockStatus(_tx: Transaction, holderId: string): Promise<AccountStatus> {
    return Promise.resolve(this.statuses.get(holderId) ?? 'ACTIVE');
  }

  block(_tx: Transaction, input: { holderId: string }): Promise<void> {
    if (this.statuses.get(input.holderId) === 'BLOCKED') {
      return Promise.reject(new AccountAlreadyBlocked());
    }
    this.statuses.set(input.holderId, 'BLOCKED');
    return Promise.resolve();
  }

  unblock(_tx: Transaction, input: { holderId: string }): Promise<void> {
    if (this.statuses.get(input.holderId) !== 'BLOCKED') {
      return Promise.reject(new AccountNotBlocked());
    }
    this.statuses.set(input.holderId, 'ACTIVE');
    return Promise.resolve();
  }

  // CustomerAccessPort
  lockOut(_tx: Transaction, input: { userId: string }): Promise<void> {
    this.lockedOut.add(input.userId);
    return Promise.resolve();
  }

  restore(_tx: Transaction, input: { userId: string }): Promise<void> {
    this.lockedOut.delete(input.userId);
    return Promise.resolve();
  }

  // StaffNamesPort
  namesOf(_tx: Transaction, ids: string[]): Promise<Map<string, string>> {
    return Promise.resolve(
      new Map(
        ids.flatMap((id) => (this.staffNames.has(id) ? [[id, this.staffNames.get(id) ?? '']] : [])),
      ),
    );
  }

  /** The requests, idempotency records and audit trail of the commands' transaction. */
  readonly repositories: OperationsRepositoriesFactory = { for: () => this.#repositories() };

  #repositories(): OperationsRepositories {
    const audit = { record: (event: AuditEvent) => this.#record(event) };
    const requests: RequestsRepository = {
      insert: (state) => {
        this.requests.set(state.id, { ...state });
        return Promise.resolve();
      },
      lock: (id) => Promise.resolve(this.#copy(id)),
      find: (id) => Promise.resolve(this.#copy(id)),
      insertDecision: (state) => {
        const stored = this.requests.get(state.id);
        if (stored?.decision) return Promise.reject(new Error('decisions_pkey'));
        this.requests.set(state.id, { ...state });
        return Promise.resolve();
      },
      // One kind of request so far: the customer and the time decide.
      hasPending: (customerId, _kind, now) =>
        Promise.resolve(
          [...this.requests.values()].some(
            (request) =>
              request.customerId === customerId &&
              request.decision === null &&
              now < request.expiresAt,
          ),
        ),
      pendingForExceptions: (exceptionIds, now) =>
        Promise.resolve(
          new Map(
            [...this.requests.values()]
              .filter(
                (request) =>
                  request.exceptionId !== null &&
                  exceptionIds.includes(request.exceptionId) &&
                  request.decision === null &&
                  now < request.expiresAt,
              )
              .map((request) => [request.exceptionId ?? '', request.id]),
          ),
        ),
      hasPendingForTransfer: (transferId, now) =>
        Promise.resolve(
          [...this.requests.values()].some(
            (request) =>
              request.transferId === transferId &&
              request.decision === null &&
              now < request.expiresAt,
          ),
        ),
      list: ({ onlyDemo }) =>
        Promise.resolve(
          [...this.requests.values()].filter((request) => !onlyDemo || request.demoScope),
        ),
    };
    const idempotency = {
      claim: (claim: IdempotencyClaim): Promise<ClaimResult> => {
        const id = `${claim.userId}:${claim.key}`;
        const found = this.#records.get(id);
        if (found) {
          return Promise.resolve({
            claimed: false,
            operation: found.operation,
            requestHash: found.requestHash,
            response: found.response,
          });
        }
        this.#records.set(id, { ...claim, response: null });
        return Promise.resolve({ claimed: true });
      },
      complete: (userId: string, key: string, response: StoredResponse): Promise<void> => {
        const record = this.#records.get(`${userId}:${key}`);
        if (record) record.response = response;
        return Promise.resolve();
      },
    };
    return { requests, idempotency, audit };
  }

  #record(event: AuditEvent): Promise<void> {
    this.audit.push(event);
    return Promise.resolve();
  }

  #copy(id: string): ApprovalRequestState | null {
    const found = this.requests.get(id);
    return found ? { ...found } : null;
  }
}
