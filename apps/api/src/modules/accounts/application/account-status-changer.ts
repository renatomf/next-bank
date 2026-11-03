import type { IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { Account, type AccountState, type AccountStatus } from '../domain/account.ts';
import type { AccountsRepositoriesFactory } from './ports.ts';

interface StaffChange {
  holderId: string;
  actorId: string;
  requestId: string | null;
  now: Date;
}

/**
 * Accounts' answer to the port Operations defines (v1.3.0 plan, task 4), in
 * the caller's transaction: the account found by its holder and locked FOR
 * UPDATE, so a block waits for any Pix holding it FOR SHARE and the Pix
 * after it finds it blocked (database.md 7). The aggregate decides whether
 * the change is allowed; every change is audited with the staff member.
 */
export class AccountStatusChanger {
  readonly #repositories: AccountsRepositoriesFactory;
  readonly #ids: IdGenerator;

  constructor(deps: { repositories: AccountsRepositoriesFactory; ids: IdGenerator }) {
    this.#repositories = deps.repositories;
    this.#ids = deps.ids;
  }

  async lockStatus(tx: Transaction, holderId: string): Promise<AccountStatus> {
    return (await this.#lock(tx, holderId)).status;
  }

  async block(tx: Transaction, input: StaffChange & { reason: string }): Promise<void> {
    const account = Account.restore(await this.#lock(tx, input.holderId));
    account.block(input.now);
    await this.#save(tx, account.state, input, 'ACCOUNT_BLOCKED', { reason: input.reason });
  }

  async unblock(tx: Transaction, input: StaffChange): Promise<void> {
    const account = Account.restore(await this.#lock(tx, input.holderId));
    account.unblock(input.now);
    await this.#save(tx, account.state, input, 'ACCOUNT_UNBLOCKED', {});
  }

  async #lock(tx: Transaction, holderId: string): Promise<AccountState> {
    const account = await this.#repositories.for(tx).accounts.lockByHolder(holderId);
    // Every customer has an account, opened with the registration.
    if (!account) throw new Error(`Customer ${holderId} has no account`);
    return account;
  }

  async #save(
    tx: Transaction,
    state: AccountState,
    input: StaffChange,
    action: 'ACCOUNT_BLOCKED' | 'ACCOUNT_UNBLOCKED',
    metadata: Record<string, string>,
  ): Promise<void> {
    const repositories = this.#repositories.for(tx);
    await repositories.accounts.updateStatus(state);
    await repositories.audit.record({
      id: this.#ids.next(),
      occurredAt: input.now,
      actorType: 'STAFF',
      actorId: input.actorId,
      action,
      subjectType: 'ACCOUNT',
      subjectId: state.id,
      requestId: input.requestId,
      metadata: { customerId: input.holderId, ...metadata },
    });
  }
}
