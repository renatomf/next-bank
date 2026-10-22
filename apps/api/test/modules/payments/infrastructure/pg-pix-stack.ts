import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { createAccountsModule } from '../../../../src/modules/accounts/index.ts';
import { CreatePin } from '../../../../src/modules/identity/application/create-pin.ts';
import { PayeeDirectory } from '../../../../src/modules/identity/application/payee-directory.ts';
import type { SecretHasher } from '../../../../src/modules/identity/application/ports.ts';
import { VerifyPin } from '../../../../src/modules/identity/application/verify-pin.ts';
import { PgIdentityRepositories } from '../../../../src/modules/identity/infrastructure/pg-identity-repositories.ts';
import { createLedgerModule } from '../../../../src/modules/ledger/index.ts';
import { AuthorizePixTransfer } from '../../../../src/modules/payments/application/authorize-pix-transfer.ts';
import { CreatePixTransfer } from '../../../../src/modules/payments/application/create-pix-transfer.ts';
import type { PixTransferView } from '../../../../src/modules/payments/application/pix-transfer-view.ts';
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
export function pgPixStack(pool: pg.Pool, clock: Clock) {
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
  };
  const create = new CreatePixTransfer({
    unitOfWork,
    repositories,
    protector: new AesGcmPixKeyProtector(PII_KEYS),
    fingerprint,
    accounts: accounts.directory,
    identity,
    ledger: ledgerPort,
    quota: { tryTake: () => true, charge: () => undefined },
    clock,
    ids,
    spi: null,
  });
  const authorize = new AuthorizePixTransfer({
    unitOfWork,
    repositories,
    fingerprint,
    accounts: accounts.directory,
    identity,
    ledger: ledgerPort,
    endToEndIds: new CryptoEndToEndIds(),
    // Pix between next bank customers only: none writes a message.
    outbox: { enqueue: () => Promise.reject(new Error('internal Pix writes no message')) },
    clock,
    ids,
  });

  return {
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

    authorize(from: Customer, transferId: string): Promise<PixTransferView> {
      return authorize.execute({
        userId: from.userId,
        sessionId: 'session-test',
        transferId,
        idempotencyKey: randomUUID(),
        pin: PIN,
        requestId: null,
      });
    },
  };
}
