import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { createAccountsModule } from '../../../../src/modules/accounts/index.ts';
import { CreatePin } from '../../../../src/modules/identity/application/create-pin.ts';
import { PayeeDirectory } from '../../../../src/modules/identity/application/payee-directory.ts';
import type { SecretHasher } from '../../../../src/modules/identity/application/ports.ts';
import { VerifyPin } from '../../../../src/modules/identity/application/verify-pin.ts';
import { PgIdentityRepositories } from '../../../../src/modules/identity/infrastructure/pg-identity-repositories.ts';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import {
  ApplySpiOutcome,
  type SpiOutcome,
} from '../../../../src/modules/payments/application/apply-spi-outcome.ts';
import { AuthorizePixTransfer } from '../../../../src/modules/payments/application/authorize-pix-transfer.ts';
import { CancelPixSchedule } from '../../../../src/modules/payments/application/cancel-pix-schedule.ts';
import { CreatePixSchedule } from '../../../../src/modules/payments/application/create-pix-schedule.ts';
import { GetPixSchedules } from '../../../../src/modules/payments/application/get-pix-schedules.ts';
import type { PixScheduleView } from '../../../../src/modules/payments/application/pix-schedule-view.ts';
import { RunDueSchedules } from '../../../../src/modules/payments/application/run-due-schedules.ts';
import type { ScheduleRecurrence } from '../../../../src/modules/payments/domain/pix-schedule.ts';
import { CheckPendingPix } from '../../../../src/modules/payments/application/check-pending-pix.ts';
import { SEND_EXTERNAL_PIX } from '../../../../src/modules/payments/application/process-pix.ts';
import { SendExternalPix } from '../../../../src/modules/payments/application/send-external-pix.ts';
import { createOutbox } from '../../../../src/shared/infrastructure/outbox-factory.ts';
import { CreatePixTransfer } from '../../../../src/modules/payments/application/create-pix-transfer.ts';
import type { PixTransferView } from '../../../../src/modules/payments/application/pix-transfer-view.ts';
import type { SpiPort } from '../../../../src/modules/payments/application/ports.ts';
import type { PixKeyType } from '../../../../src/modules/payments/domain/pix-key.ts';
import type { Outbox } from '../../../../src/shared/application/outbox.ts';
import { AesGcmPixKeyProtector } from '../../../../src/modules/payments/infrastructure/aes-gcm-pix-key-protector.ts';
import { CryptoEndToEndIds } from '../../../../src/modules/payments/infrastructure/crypto-end-to-end-ids.ts';
import { HmacRequestFingerprint } from '../../../../src/shared/infrastructure/hmac-request-fingerprint.ts';
import { PgPaymentsRepositories } from '../../../../src/modules/payments/infrastructure/pg-payments-repositories.ts';
import type { Clock } from '../../../../src/shared/application/ports.ts';
import { PgUnitOfWork } from '../../../../src/shared/infrastructure/pg-unit-of-work.ts';
import { UuidV7Generator } from '../../../../src/shared/infrastructure/system-ports.ts';
import {
  PII_KEYS,
  pgRegisterCustomer,
} from '../../../application/onboarding/pg-register-customer-stack.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

const PIN = '2580';

/** Not Argon2id: a thousand Pix would take minutes (week 5 plan, D11). */
const fastPinHasher: SecretHasher = {
  hash: (secret) => Promise.resolve(`pin:${secret}`),
  verify: (hash, secret) => Promise.resolve(hash === `pin:${secret}`),
};

export interface Customer {
  userId: string;
  cpf: string;
}

/**
 * The real Pix on Postgres: real repositories, the real PIN counter with its row
 * lock and the real ledger with ordered locks. Only the PIN hash is fast and the
 * lookup quota is open, so tests can send a Pix as many times as they need.
 */
export function pgPixStack(
  pool: pg.Pool,
  clock: Clock,
  // The Pix to other banks (v1.2.0 plan, tasks 3 and 4): off unless given.
  // Without an outbox, the stack writes to the real one and its worker sends
  // the Pix to the SPI.
  external: { spi: SpiPort; outbox?: Outbox } | null = null,
) {
  const ids = new UuidV7Generator();
  const unitOfWork = new PgUnitOfWork(pool);
  const ledger = createLedgerModule({ clock, ids });
  const accounts = createAccountsModule({
    unitOfWork,
    clock,
    ids,
    ledger: ledger.customerAccounts,
  });
  const identityRepositories = new PgIdentityRepositories();
  const pinSteps = {
    unitOfWork,
    repositories: identityRepositories,
    clock,
    ids,
    pinHasher: fastPinHasher,
  };
  const createPin = new CreatePin(pinSteps);
  const verifyPin = new VerifyPin(pinSteps);
  const payees = new PayeeDirectory(identityRepositories);
  const register = pgRegisterCustomer(pool, clock);

  const repositories = new PgPaymentsRepositories();
  const fingerprint = new HmacRequestFingerprint(PII_KEYS);
  const identity = {
    payeeOf: payees.payeeOf.bind(payees),
    verifyPin: verifyPin.verify.bind(verifyPin),
  };
  const ledgerPort = {
    availableBalance: ledger.customerAccounts.availableBalance.bind(ledger.customerAccounts),
    postPixTransfer: ledger.customerAccounts.transferPix.bind(ledger.customerAccounts),
    postExternalPix: ledger.customerAccounts.sendPixExternal.bind(ledger.customerAccounts),
    settleExternalPix: ledger.customerAccounts.settlePixExternal.bind(ledger.customerAccounts),
    refundExternalPix: ledger.customerAccounts.refundPixExternal.bind(ledger.customerAccounts),
  };
  const protector = new AesGcmPixKeyProtector(PII_KEYS);
  const realOutbox =
    external && !external.outbox
      ? createOutbox({
          pool,
          ids,
          clock: () => clock.now(),
          errorReporter: { report: () => undefined },
          handlers: new Map([
            [
              SEND_EXTERNAL_PIX,
              (message) =>
                new SendExternalPix({
                  unitOfWork,
                  repositories,
                  protector,
                  accounts: accounts.directory,
                  identity,
                  spi: external.spi,
                }).handle(message),
            ],
          ]),
        })
      : null;
  // Without the Pix to other banks, no Pix writes a message.
  const outbox: Outbox = external?.outbox ??
    realOutbox?.outbox ?? {
      enqueue: () => Promise.reject(new Error('internal Pix writes no message')),
    };
  const applySpiOutcome = new ApplySpiOutcome({
    unitOfWork,
    repositories,
    ledger: ledgerPort,
    clock,
    ids,
  });
  const checkPending =
    external &&
    new CheckPendingPix({
      unitOfWork,
      repositories,
      spi: external.spi,
      outbox,
      applySpiOutcome,
      clock,
    });
  const create = new CreatePixTransfer({
    unitOfWork,
    repositories,
    protector,
    fingerprint,
    accounts: accounts.directory,
    identity,
    ledger: ledgerPort,
    quota: { tryTake: () => true, charge: () => undefined },
    clock,
    ids,
    spi: external?.spi ?? null,
  });
  const authorize = new AuthorizePixTransfer({
    unitOfWork,
    repositories,
    fingerprint,
    accounts: accounts.directory,
    identity,
    ledger: ledgerPort,
    endToEndIds: new CryptoEndToEndIds(),
    outbox,
    clock,
    ids,
  });

  const scheduleDeps = {
    unitOfWork,
    repositories,
    accounts: accounts.directory,
    identity,
    ledger: ledgerPort,
    endToEndIds: new CryptoEndToEndIds(),
    outbox,
    clock,
    ids,
  };
  const createSchedule = new CreatePixSchedule({
    ...scheduleDeps,
    protector,
    fingerprint,
    quota: { tryTake: () => true, charge: () => undefined },
    spi: external?.spi ?? null,
  });
  const runDue = new RunDueSchedules(scheduleDeps);
  const cancelSchedule = new CancelPixSchedule(scheduleDeps);
  const schedules = new GetPixSchedules(scheduleDeps);

  return {
    /** The scheduled Pix (v1.2.0 plan, task 7): reading them as their payer. */
    schedules,
    /** One round of the worker of the scheduled Pix, as the API's loop runs it. */
    runDueSchedules: () => runDue.runOnce(),
    cancelSchedule: (from: Customer, scheduleId: string) =>
      cancelSchedule.execute({
        userId: from.userId,
        sessionId: 'session-test',
        scheduleId,
        requestId: null,
      }),

    /** Schedules a Pix to any key, with the PIN, from [firstDate] on. */
    schedule(
      from: Customer,
      key: { type: PixKeyType; value: string },
      cents: number,
      options: {
        firstDate: string;
        recurrence?: ScheduleRecurrence;
        idempotencyKey?: string;
      },
    ): Promise<PixScheduleView> {
      return createSchedule.execute({
        userId: from.userId,
        sessionId: 'session-test',
        idempotencyKey: options.idempotencyKey ?? randomUUID(),
        key,
        amountCents: cents,
        description: null,
        firstDate: options.firstDate,
        recurrence: options.recurrence ?? { frequency: 'ONCE' },
        pin: PIN,
        requestId: null,
      });
    },

    /** Delivers the outbox, as the API's loop does; only with the real outbox. */
    deliverOutbox: () => realOutbox?.worker.runOnce(100) ?? Promise.resolve(0),
    /** The SPI's answer, as the webhook or the status check bring it (task 4). */
    applySpiOutcome: (outcome: SpiOutcome) => applySpiOutcome.execute(outcome),
    /** One round of the status check (v1.2.0 plan, task 4). */
    checkPending: () => checkPending?.execute() ?? Promise.resolve(0),

    /** A registered customer with R$ 10.000,00, the CPF key and the PIN. */
    async newCustomer(): Promise<Customer> {
      const cpf = fictitiousCpf();
      const { userId } = await register.execute({
        name: 'Maria Teste',
        email: uniqueEmail(),
        cpf,
        password: 'violet staple orbit 42',
        deviceLabel: null,
        requestId: null,
      });
      await createPin.execute({ userId, pin: PIN, requestId: null });
      return { userId, cpf };
    },

    /** Creates a Pix to any key, here or at another bank, and returns its id. */
    async createToKey(
      from: Customer,
      key: { type: PixKeyType; value: string },
      cents: number,
    ): Promise<string> {
      const { body } = await create.execute({
        userId: from.userId,
        sessionId: 'session-test',
        idempotencyKey: randomUUID(),
        key,
        amountCents: cents,
        description: null,
        requestId: null,
      });
      return body.id;
    },

    /** Creates a Pix awaiting the PIN and returns its id. */
    async create(from: Customer, to: Customer, cents: number): Promise<string> {
      const { body } = await create.execute({
        userId: from.userId,
        sessionId: 'session-test',
        idempotencyKey: randomUUID(),
        key: { type: 'CPF', value: to.cpf },
        amountCents: cents,
        description: null,
        requestId: null,
      });
      return body.id;
    },

    authorize(
      from: Customer,
      transferId: string,
      idempotencyKey: string = randomUUID(),
    ): Promise<PixTransferView> {
      return authorize.execute({
        userId: from.userId,
        sessionId: 'session-test',
        transferId,
        idempotencyKey,
        pin: PIN,
        requestId: null,
      });
    },
  };
}
