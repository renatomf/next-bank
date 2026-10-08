// Public API of the payments context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { CreateCpfKey } from './application/create-cpf-key.ts';
import { LookupPixKey } from './application/lookup-pix-key.ts';
import type { AccountsPort, IdentityPort } from './application/ports.ts';
import { AesGcmPixKeyProtector } from './infrastructure/aes-gcm-pix-key-protector.ts';
import { InMemoryKeyLookupQuota } from './infrastructure/in-memory-key-lookup-quota.ts';
import { PgPaymentsRepositories } from './infrastructure/pg-payments-repositories.ts';

export { keyLookupRoutes } from './http/key-lookup-route.ts';
export type { CreateCpfKey } from './application/create-cpf-key.ts';
export type { LookupPixKey } from './application/lookup-pix-key.ts';
export type { AccountsPort, IdentityPort } from './application/ports.ts';

export interface PaymentsModule {
  createCpfKey: CreateCpfKey;
  lookupPixKey: LookupPixKey;
}

/** Builds the payments context with its production adapters. */
export function createPaymentsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  piiKeys: PiiKeys;
  accounts: AccountsPort;
  identity: IdentityPort;
}): PaymentsModule {
  const repositories = new PgPaymentsRepositories();
  const protector = new AesGcmPixKeyProtector(settings.piiKeys);
  return {
    createCpfKey: new CreateCpfKey({
      repositories,
      protector,
      clock: settings.clock,
      ids: settings.ids,
    }),
    lookupPixKey: new LookupPixKey({
      unitOfWork: settings.unitOfWork,
      repositories,
      protector,
      accounts: settings.accounts,
      identity: settings.identity,
      quota: new InMemoryKeyLookupQuota(),
      clock: settings.clock,
    }),
  };
}
