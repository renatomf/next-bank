// Public API of the payments context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Outbox } from '../../shared/application/outbox.ts';
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { RandomUuidGenerator } from '../../shared/infrastructure/system-ports.ts';
import { AuthorizePixTransfer } from './application/authorize-pix-transfer.ts';
import { CancelPixTransfer } from './application/cancel-pix-transfer.ts';
import { CreateCpfKey } from './application/create-cpf-key.ts';
import { CreatePixTransfer } from './application/create-pix-transfer.ts';
import { GetPixTransfer } from './application/get-pix-transfer.ts';
import { GetReceivingKey } from './application/get-receiving-key.ts';
import { LookupPixKey } from './application/lookup-pix-key.ts';
import type { AccountsPort, IdentityPort, LedgerPort, SpiPort } from './application/ports.ts';
import { AesGcmPixKeyProtector } from './infrastructure/aes-gcm-pix-key-protector.ts';
import { CryptoEndToEndIds } from './infrastructure/crypto-end-to-end-ids.ts';
import { HmacRequestFingerprint } from '../../shared/infrastructure/hmac-request-fingerprint.ts';
import { InMemoryKeyLookupQuota } from './infrastructure/in-memory-key-lookup-quota.ts';
import { PgPaymentsRepositories } from './infrastructure/pg-payments-repositories.ts';

export { keyLookupRoutes } from './http/key-lookup-route.ts';
export { receivingKeyRoutes } from './http/receiving-key-route.ts';
export { transferRoutes } from './http/transfer-routes.ts';
export type { CreateCpfKey } from './application/create-cpf-key.ts';
export type { AuthorizePixTransfer } from './application/authorize-pix-transfer.ts';
export type { CancelPixTransfer } from './application/cancel-pix-transfer.ts';
export type { CreatePixTransfer } from './application/create-pix-transfer.ts';
export type { GetPixTransfer } from './application/get-pix-transfer.ts';
export type { GetReceivingKey } from './application/get-receiving-key.ts';
export type { LookupPixKey } from './application/lookup-pix-key.ts';
export type {
  AccountsPort,
  IdentityPort,
  LedgerPort,
  PinCheck,
  SpiPort,
} from './application/ports.ts';

export interface PaymentsModule {
  createCpfKey: CreateCpfKey;
  lookupPixKey: LookupPixKey;
  getReceivingKey: GetReceivingKey;
  createPixTransfer: CreatePixTransfer;
  authorizePixTransfer: AuthorizePixTransfer;
  getPixTransfer: GetPixTransfer;
  cancelPixTransfer: CancelPixTransfer;
}

/** Builds the payments context with its production adapters. */
export function createPaymentsModule(settings: {
  unitOfWork: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  piiKeys: PiiKeys;
  accounts: AccountsPort;
  identity: IdentityPort;
  ledger: LedgerPort;
  /** The DICT and the SPI; null while the Pix to other banks is off (P1). */
  spi: SpiPort | null;
  /** Where a Pix to another bank waits to be sent (ADR 0016). */
  outbox: Outbox;
}): PaymentsModule {
  const repositories = new PgPaymentsRepositories();
  const protector = new AesGcmPixKeyProtector(settings.piiKeys);
  // One quota for lookups and creations: both name the payee (PIX-07).
  const quota = new InMemoryKeyLookupQuota();
  const fingerprint = new HmacRequestFingerprint(settings.piiKeys);
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
      quota,
      clock: settings.clock,
      spi: settings.spi,
    }),
    getReceivingKey: new GetReceivingKey({
      unitOfWork: settings.unitOfWork,
      repositories,
      protector,
      accounts: settings.accounts,
      clock: settings.clock,
      ids: settings.ids,
      randomKeys: new RandomUuidGenerator(),
    }),
    createPixTransfer: new CreatePixTransfer({
      unitOfWork: settings.unitOfWork,
      repositories,
      protector,
      fingerprint,
      accounts: settings.accounts,
      identity: settings.identity,
      ledger: settings.ledger,
      quota,
      clock: settings.clock,
      ids: settings.ids,
      spi: settings.spi,
    }),
    authorizePixTransfer: new AuthorizePixTransfer({
      unitOfWork: settings.unitOfWork,
      repositories,
      fingerprint,
      accounts: settings.accounts,
      identity: settings.identity,
      ledger: settings.ledger,
      endToEndIds: new CryptoEndToEndIds(),
      outbox: settings.outbox,
      clock: settings.clock,
      ids: settings.ids,
    }),
    getPixTransfer: new GetPixTransfer({
      unitOfWork: settings.unitOfWork,
      repositories,
      accounts: settings.accounts,
    }),
    cancelPixTransfer: new CancelPixTransfer({
      unitOfWork: settings.unitOfWork,
      repositories,
      accounts: settings.accounts,
      clock: settings.clock,
      ids: settings.ids,
    }),
  };
}
