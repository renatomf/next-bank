import type { Clock, IdGenerator, Transaction } from '../../../shared/application/ports.ts';
import { Account } from '../domain/account.ts';
import type { AccountsRepositoriesFactory, LedgerPort } from './ports.ts';

/**
 * Opens a customer's current account and its ledger account, in the caller's
 * transaction (domain-model.md 3.2 and 8; decision D2).
 */
export class OpenAccount {
  readonly #repositories: AccountsRepositoriesFactory;
  readonly #ledger: LedgerPort;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;

  constructor(deps: {
    repositories: AccountsRepositoriesFactory;
    ledger: LedgerPort;
    clock: Clock;
    ids: IdGenerator;
  }) {
    this.#repositories = deps.repositories;
    this.#ledger = deps.ledger;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  /** Returns the id of the new account. */
  async execute(
    tx: Transaction,
    input: { holderUserId: string; requestId: string | null },
  ): Promise<string> {
    const { accounts, audit } = this.#repositories.for(tx);
    const now = this.#clock.now();
    const account = Account.open({
      id: this.#ids.next(),
      holderUserId: input.holderUserId,
      sequence: await accounts.nextSequence(),
      now,
    });

    await accounts.insert(account.state);
    await this.#ledger.open(tx, account.state.id);
    await audit.record({
      id: this.#ids.next(),
      occurredAt: now,
      actorType: 'USER',
      actorId: input.holderUserId,
      action: 'ACCOUNT_OPENED',
      subjectType: 'ACCOUNT',
      subjectId: account.state.id,
      requestId: input.requestId,
      metadata: {},
    });
    return account.state.id;
  }
}
