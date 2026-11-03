import type { IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { Session } from '../domain/session.ts';
import type { IdentityRepositoriesFactory } from './ports.ts';

/**
 * Identity's answer to the port Operations defines (v1.3.0 plan, task 4, K1):
 * a blocked customer loses access at once, in the caller's transaction. The
 * customer is LOCKED, so the login and the refresh refuse (F-12), and every
 * session still alive is revoked, each one audited with the staff member as
 * the actor. Unblocking unlocks the customer; the revoked sessions stay
 * revoked, and the customer signs in again.
 */
export class CustomerAccess {
  readonly #repositories: IdentityRepositoriesFactory;
  readonly #ids: IdGenerator;

  constructor(deps: { repositories: IdentityRepositoriesFactory; ids: IdGenerator }) {
    this.#repositories = deps.repositories;
    this.#ids = deps.ids;
  }

  async lockOut(
    tx: Transaction,
    input: { userId: string; actorId: string; requestId: string | null; now: Date },
  ): Promise<void> {
    const repositories = this.#repositories.for(tx);
    if ((await repositories.users.lockStatus(input.userId)) === null) {
      throw new Error(`Customer ${input.userId} not found while locking it out`);
    }
    await repositories.users.updateStatus(input.userId, 'LOCKED', input.now);
    // In id order, as the password change locks them: never a deadlock between the two.
    for (const state of await repositories.sessions.lockActiveByUser(input.userId, input.now)) {
      const session = Session.restore(state);
      session.revoke('ACCOUNT_BLOCKED', input.now);
      await repositories.sessions.update(session.state);
      await repositories.audit.record({
        id: this.#ids.next(),
        occurredAt: input.now,
        actorType: 'STAFF',
        actorId: input.actorId,
        action: 'SESSION_REVOKED',
        subjectType: 'SESSION',
        subjectId: state.id,
        requestId: input.requestId,
        metadata: { reason: 'ACCOUNT_BLOCKED' },
      });
    }
  }

  async restore(tx: Transaction, input: { userId: string; now: Date }): Promise<void> {
    const repositories = this.#repositories.for(tx);
    if ((await repositories.users.lockStatus(input.userId)) === null) {
      throw new Error(`Customer ${input.userId} not found while restoring it`);
    }
    await repositories.users.updateStatus(input.userId, 'ACTIVE', input.now);
  }
}
