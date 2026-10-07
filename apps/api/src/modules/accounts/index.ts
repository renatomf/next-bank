// Public API of the accounts context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator } from '../../shared/application/ports.ts';
import { OpenAccount } from './application/open-account.ts';
import type { LedgerPort } from './application/ports.ts';
import { PgAccountsRepositories } from './infrastructure/pg-accounts-repository.ts';

export type { OpenAccount } from './application/open-account.ts';
export type { LedgerPort } from './application/ports.ts';

export interface AccountsModule {
  openAccount: OpenAccount;
}

/** Builds the accounts context with its production adapters. */
export function createAccountsModule(settings: {
  clock: Clock;
  ids: IdGenerator;
  ledger: LedgerPort;
}): AccountsModule {
  return {
    openAccount: new OpenAccount({ repositories: new PgAccountsRepositories(), ...settings }),
  };
}
