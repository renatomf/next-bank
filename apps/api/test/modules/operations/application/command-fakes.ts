import type {
  AccountStatus,
  AccountStatusPort,
  CustomerAccessPort,
  OperationsRepositories,
  OperationsRepositoriesFactory,
  RequestsRepository,
  StaffNamesPort,
} from '../../../../src/modules/operations/application/ports.ts';
import type { ApprovalRequestState } from '../../../../src/modules/operations/domain/approval-request.ts';
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
  implements AccountStatusPort, CustomerAccessPort, StaffNamesPort
{
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
