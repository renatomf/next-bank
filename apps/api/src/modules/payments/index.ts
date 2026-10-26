// Public API of the payments context: other modules and the application layer
// use only what is exported here (ADR 0002, ADR 0010).
import type { Outbox, OutboxHandler } from '../../shared/application/outbox.ts';
import type { Clock, IdGenerator, UnitOfWork } from '../../shared/application/ports.ts';
import type { PiiKeys } from '../../shared/infrastructure/aes-gcm-pii-protector.ts';
import { RandomUuidGenerator } from '../../shared/infrastructure/system-ports.ts';
import { ApplySpiOutcome } from './application/apply-spi-outcome.ts';
import { AuthorizePixTransfer, SEND_EXTERNAL_PIX } from './application/authorize-pix-transfer.ts';
import { CancelPixTransfer } from './application/cancel-pix-transfer.ts';
import { CheckPendingPix } from './application/check-pending-pix.ts';
import { CreateCpfKey } from './application/create-cpf-key.ts';
import { CreatePixTransfer } from './application/create-pix-transfer.ts';
import { GetPixTransfer } from './application/get-pix-transfer.ts';
import { GetReceivingKey } from './application/get-receiving-key.ts';
import { LookupPixKey } from './application/lookup-pix-key.ts';
import { SendExternalPix } from './application/send-external-pix.ts';
import type { AccountsPort, IdentityPort, LedgerPort, SpiPort } from './application/ports.ts';
import { AesGcmPixKeyProtector } from './infrastructure/aes-gcm-pix-key-protector.ts';
import { CryptoEndToEndIds } from './infrastructure/crypto-end-to-end-ids.ts';
import { HmacRequestFingerprint } from '../../shared/infrastructure/hmac-request-fingerprint.ts';
import { InMemoryKeyLookupQuota } from './infrastructure/in-memory-key-lookup-quota.ts';
import { PgPaymentsRepositories } from './infrastructure/pg-payments-repositories.ts';

export { HttpSpiClient } from './infrastructure/http-spi-client.ts';
export { keyLookupRoutes } from './http/key-lookup-route.ts';
export { spiWebhookRoutes } from './http/spi-webhook-route.ts';
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

export type { ApplySpiOutcome } from './application/apply-spi-outcome.ts';

export interface PaymentsModule {
  applySpiOutcome: ApplySpiOutcome;
  /** The status check of the Pix left without the SPI's answer; none while it is off. */
  checkPendingPix: CheckPendingPix | null;
  createCpfKey: CreateCpfKey;
  lookupPixKey: LookupPixKey;
  getReceivingKey: GetReceivingKey;
  createPixTransfer: CreatePixTransfer;
  authorizePixTransfer: AuthorizePixTransfer;
  getPixTransfer: GetPixTransfer;
  cancelPixTransfer: CancelPixTransfer;
}

/**
 * The messages Payments delivers through the outbox (ADR 0016), by type.
 * Built apart from the module, which needs the outbox these feed; none while
 * the Pix to other banks is off (P1).
 */
export function createPaymentsOutboxHandlers(settings: {
  unitOfWork: UnitOfWork;
  piiKeys: PiiKeys;
  accounts: AccountsPort;
  identity: IdentityPort;
  spi: SpiPort | null;
}): ReadonlyMap<string, OutboxHandler> {
  if (settings.spi === null) return new Map();
  const send = new SendExternalPix({
    unitOfWork: settings.unitOfWork,
    repositories: new PgPaymentsRepositories(),
    protector: new AesGcmPixKeyProtector(settings.piiKeys),
    accounts: settings.accounts,
    identity: settings.identity,
    spi: settings.spi,
  });
  return new Map([[SEND_EXTERNAL_PIX, (message) => send.handle(message)]]);
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
  const applySpiOutcome = new ApplySpiOutcome({
    unitOfWork: settings.unitOfWork,
    repositories,
    ledger: settings.ledger,
    clock: settings.clock,
    ids: settings.ids,
  });
  return {
    applySpiOutcome,
    checkPendingPix:
      settings.spi &&
      new CheckPendingPix({
        unitOfWork: settings.unitOfWork,
        repositories,
        spi: settings.spi,
        outbox: settings.outbox,
        applySpiOutcome,
        clock: settings.clock,
      }),
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
