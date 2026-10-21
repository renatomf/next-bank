// Public API of the top-ups context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { HmacRequestFingerprint } from '../../shared/infrastructure/hmac-request-fingerprint.ts';
import { CreateTopUp } from './application/create-top-up.ts';
import { GetTopUp } from './application/get-top-up.ts';
import type { AccountsPort, IdentityPort, LedgerPort } from './application/ports.ts';
import { AesGcmPhoneProtector } from './infrastructure/aes-gcm-phone-protector.ts';
import { FakeTopUpProvider } from './infrastructure/fake-top-up-provider.ts';
import { PgTopUpsRepositories } from './infrastructure/pg-top-ups-repositories.ts';

export { topUpRoutes } from './http/top-up-routes.ts';
export type { CreateTopUp } from './application/create-top-up.ts';
export type { GetTopUp } from './application/get-top-up.ts';
export type { AccountsPort, IdentityPort, LedgerPort } from './application/ports.ts';

export interface TopUpsModule {
  createTopUp: CreateTopUp;
  getTopUp: GetTopUp;
}

/** Builds the top-ups context with its production adapters. */
export function createTopUpsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  piiKeys: PiiKeys;
  /** The number's own key (TOP-01, decision R6). */
  phoneKey: Uint8Array;
  accounts: AccountsPort;
  identity: IdentityPort;
  ledger: LedgerPort;
}): TopUpsModule {
  const repositories = new PgTopUpsRepositories();
  return {
    createTopUp: new CreateTopUp({
      unitOfWork: settings.unitOfWork,
      repositories,
      fingerprint: new HmacRequestFingerprint(settings.piiKeys),
      accounts: settings.accounts,
      identity: settings.identity,
      ledger: settings.ledger,
      provider: new FakeTopUpProvider(),
      protector: new AesGcmPhoneProtector({
        encryptionKey: settings.phoneKey,
        unusedHmacKey: settings.piiKeys.hmacKey,
      }),
      clock: settings.clock,
      ids: settings.ids,
    }),
    getTopUp: new GetTopUp({
      unitOfWork: settings.unitOfWork,
      repositories,
      accounts: settings.accounts,
    }),
  };
}
