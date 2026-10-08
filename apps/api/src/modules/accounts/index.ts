// Public API of the accounts context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import { AccountDirectory } from './application/account-directory.ts';
import { GetMyAccount } from './application/get-my-account.ts';
import { GetMyStatement } from './application/get-my-statement.ts';
import { OpenAccount } from './application/open-account.ts';
import type { LedgerPort } from './application/ports.ts';
import { PgAccountsRepositories } from './infrastructure/pg-accounts-repository.ts';

export { myAccountRoutes } from './http/my-account-route.ts';
export { statementRoutes } from './http/statement-route.ts';
export type { AccountDirectory } from './application/account-directory.ts';
export type { GetMyAccount } from './application/get-my-account.ts';
export type { GetMyStatement } from './application/get-my-statement.ts';
export type { OpenAccount } from './application/open-account.ts';
export type { LedgerPort } from './application/ports.ts';

export interface AccountsModule {
  openAccount: OpenAccount;
  getMyAccount: GetMyAccount;
  getMyStatement: GetMyStatement;
  /** Implements the AccountsPort of Payments. */
  directory: AccountDirectory;
}

/** Builds the accounts context with its production adapters. */
export function createAccountsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  ledger: LedgerPort;
}): AccountsModule {
  const repositories = new PgAccountsRepositories();
  return {
    openAccount: new OpenAccount({ repositories, ...settings }),
    getMyAccount: new GetMyAccount({ repositories, ...settings }),
    getMyStatement: new GetMyStatement({ repositories, ...settings }),
    directory: new AccountDirectory(repositories),
  };
}
