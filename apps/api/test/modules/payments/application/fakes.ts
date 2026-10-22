import type {
  ClaimResult,
  IdempotencyClaim,
  IdempotencyRepository,
  RequestFingerprint,
  StoredResponse,
} from '../../../../src/shared/application/idempotency.ts';
import { DomainError } from '../../../../src/shared/domain/domain-error.ts';
import type { Outbox, OutboxMessage } from '../../../../src/shared/application/outbox.ts';
import type {
  AccountsPort,
  DictKey,
  EndToEndIds,
  ExternalPixPosting,
  PinCheck,
  PixPosting,
  IdentityPort,
  LedgerPort,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PayeeAccount,
  PixKeyValueProtector,
  ProtectedKeyValue,
  SealedKeyValue,
  SpiPayment,
  SpiPort,
  StoredPixKey,
  StoredRandomKey,
} from '../../../../src/modules/payments/application/ports.ts';
import type { PixKeyState, PixKeyType } from '../../../../src/modules/payments/domain/pix-key.ts';
import type { PixTransferState } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import type {
  AuditEvent,
  Transaction,
  UnitOfWork,
} from '../../../../src/shared/application/ports.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

export const TX: Transaction = { kind: 'transaction' };

/** Runs the work right away and counts the transactions. */
export class FakeUnitOfWork implements UnitOfWork {
  runs = 0;
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    this.runs += 1;
    return work(TX);
  }
}

/** Not encryption: shows which value and type each call protected, and reverses it. */
export class FakeKeyProtector implements PixKeyValueProtector {
  protect(type: PixKeyType, value: string): ProtectedKeyValue {
    return {
      ciphertext: new TextEncoder().encode(`sealed(${type}:${value})`),
      blindIndex: this.blindIndex(type, value),
      keyVersion: 1,
    };
  }
  blindIndex(type: PixKeyType, value: string): Uint8Array {
    return new TextEncoder().encode(`index(${type}:${value})`);
  }
  reveal(type: PixKeyType, sealed: SealedKeyValue): string {
    const text = textOf(sealed.ciphertext);
    const prefix = `sealed(${type}:`;
    if (!text.startsWith(prefix)) throw new Error(`Not a sealed ${type} key: ${text}`);
    return text.slice(prefix.length, -1);
  }
}

/** Random UUIDs v4 in a known order, so tests can expect them. */
export class SequentialRandomUuids {
  #next = 1;
  next(): string {
    return `00000000-0000-4000-8000-${String(this.#next++).padStart(12, '0')}`;
  }
}

/** Not a keyed hash: readable, so tests see what was fingerprinted. */
export class FakeFingerprint implements RequestFingerprint {
  of(operation: string, payload: unknown): Uint8Array {
    return new TextEncoder().encode(`${operation}|${JSON.stringify(payload)}`);
  }
}

interface StoredRecord extends IdempotencyClaim {
  response: StoredResponse | null;
}

/** Pix keys, transfers, idempotency records and audit events kept in memory. */
export class FakePaymentsRepositories implements PaymentsRepositoriesFactory {
  readonly keys = new Map<string, StoredPixKey>();
  readonly transfers: PixTransferState[] = [];
  readonly records = new Map<string, StoredRecord>();
  readonly auditEvents: AuditEvent[] = [];
  /** The random key of each account, as stored: sealed, never in clear. */
  readonly randomKeys = new Map<string, StoredRandomKey>();
  /** Every random key offered for insertion, kept or not. */
  readonly offeredRandomKeys: PixKeyState[] = [];
  /** The sealed key of each Pix to another bank, by the Pix id. */
  readonly payeeKeys = new Map<string, SealedKeyValue>();
  lookups = 0;

  addKey(type: PixKeyType, value: string, key: StoredPixKey): void {
    this.keys.set(textOf(new FakeKeyProtector().blindIndex(type, value)), key);
  }

  #transferOf(id: string, payerAccountId: string): PixTransferState | null {
    const found = this.transfers.find(
      (transfer) => transfer.id === id && transfer.payerAccountId === payerAccountId,
    );
    return found ? copyOf(found) : null;
  }

  for(): PaymentsRepositories {
    const idempotency: IdempotencyRepository = {
      claim: (claim): Promise<ClaimResult> => {
        const existing = this.records.get(`${claim.userId}|${claim.key}`);
        if (existing) {
          return Promise.resolve({
            claimed: false,
            operation: existing.operation,
            requestHash: existing.requestHash,
            response: existing.response,
          });
        }
        this.records.set(`${claim.userId}|${claim.key}`, { ...claim, response: null });
        return Promise.resolve({ claimed: true });
      },
      complete: (userId, key, response) => {
        const record = this.records.get(`${userId}|${key}`);
        if (record) record.response = response;
        return Promise.resolve();
      },
    };
    return {
      pixKeys: {
        insert: () => Promise.resolve(),
        findByIndex: (_type, blindIndex) => {
          this.lookups += 1;
          return Promise.resolve(this.keys.get(textOf(blindIndex)) ?? null);
        },
        // Like ON CONFLICT DO NOTHING on the one-random-key-per-account index.
        insertRandomIfAbsent: (key, value) => {
          this.offeredRandomKeys.push(key);
          if (this.randomKeys.has(key.accountId)) return Promise.resolve(false);
          this.randomKeys.set(key.accountId, {
            ciphertext: value.ciphertext,
            keyVersion: value.keyVersion,
            masked: key.masked,
          });
          return Promise.resolve(true);
        },
        findRandomOf: (accountId) => Promise.resolve(this.randomKeys.get(accountId) ?? null),
      },
      pixTransfers: {
        insert: (state, payeeKey) => {
          this.transfers.push(state);
          if (payeeKey) this.payeeKeys.set(state.id, payeeKey);
          return Promise.resolve();
        },
        findForPayer: (id, payerAccountId) => Promise.resolve(this.#transferOf(id, payerAccountId)),
        lockForPayer: (id, payerAccountId) => Promise.resolve(this.#transferOf(id, payerAccountId)),
        update: (state) => {
          const index = this.transfers.findIndex((transfer) => transfer.id === state.id);
          this.transfers[index] = state;
          return Promise.resolve();
        },
      },
      idempotency,
      audit: {
        record: (event) => {
          this.auditEvents.push(event);
          return Promise.resolve();
        },
      },
    };
  }
}

/** Only the payer's own Pix is ever found (PIX-01). */
function copyOf(state: PixTransferState): PixTransferState {
  return { ...state, payee: { ...state.payee } };
}

export class FakeAccounts implements AccountsPort {
  readonly accounts = new Map<string, PayeeAccount>();
  findById(_tx: Transaction, accountId: string): Promise<PayeeAccount | null> {
    return Promise.resolve(this.accounts.get(accountId) ?? null);
  }
  lockForShare(_tx: Transaction, accountIds: string[]): Promise<PayeeAccount[]> {
    this.sharedLocks.push([...accountIds]);
    return Promise.resolve(
      accountIds.flatMap((id) => {
        const account = this.accounts.get(id);
        return account ? [account] : [];
      }),
    );
  }
  sharedLocks: string[][] = [];
  findByHolder(_tx: Transaction, userId: string): Promise<PayeeAccount | null> {
    return Promise.resolve(
      [...this.accounts.values()].find((account) => account.holderUserId === userId) ?? null,
    );
  }
}

export class FakeIdentity implements IdentityPort {
  readonly people = new Map<string, { name: string; documentMasked: string }>();
  /** The outcome of the next PIN checks, in order; then the PIN is right. */
  pinOutcomes: PinCheck[] = [];
  pinsChecked: string[] = [];
  verifyPin(_tx: Transaction, input: { userId: string; pin: string }): Promise<PinCheck> {
    this.pinsChecked.push(input.pin);
    return Promise.resolve(this.pinOutcomes.shift() ?? { outcome: 'VERIFIED' });
  }
  payeeOf(_tx: Transaction, userId: string) {
    return Promise.resolve(this.people.get(userId) ?? null);
  }
}

/** Same code as the ledger's error: Payments knows it only by its catalog code. */
class LedgerInsufficientFunds extends DomainError {
  readonly code = 'InsufficientFunds';
}

export class FakeLedger implements LedgerPort {
  readonly balances = new Map<string, Money>();
  readonly posted: PixPosting[] = [];
  /** Pix to other banks: debited from the payer to system:pix_clearing. */
  readonly postedExternal: ExternalPixPosting[] = [];
  postExternalPix(_tx: Transaction, posting: ExternalPixPosting): Promise<void> {
    const balance = this.balances.get(posting.payerAccountId) ?? Money.zero();
    if (balance.isLessThan(posting.amount)) {
      return Promise.reject(new LedgerInsufficientFunds('Debit above the available balance'));
    }
    this.postedExternal.push(posting);
    this.balances.set(posting.payerAccountId, balance.minus(posting.amount));
    return Promise.resolve();
  }
  postPixTransfer(_tx: Transaction, posting: PixPosting): Promise<void> {
    const balance = this.balances.get(posting.payerAccountId) ?? Money.zero();
    if (balance.isLessThan(posting.amount)) {
      return Promise.reject(new LedgerInsufficientFunds('Debit above the available balance'));
    }
    this.posted.push(posting);
    this.balances.set(posting.payerAccountId, balance.minus(posting.amount));
    return Promise.resolve();
  }
  availableBalance(_tx: Transaction, accountId: string): Promise<Money | null> {
    return Promise.resolve(this.balances.get(accountId) ?? null);
  }
}

/** The DICT and the SPI of other (made-up) banks, in memory. */
export class FakeSpi implements SpiPort {
  readonly keys = new Map<string, DictKey>();
  readonly lookups: string[] = [];
  readonly sent: SpiPayment[] = [];
  /** Unreachable: every call throws, as a timeout would. */
  down = false;

  findKey(key: string): Promise<DictKey | null> {
    if (this.down) return Promise.reject(new Error('DICT unreachable'));
    this.lookups.push(key);
    return Promise.resolve(this.keys.get(key) ?? null);
  }
  send(payment: SpiPayment): Promise<void> {
    if (this.down) return Promise.reject(new Error('SPI unreachable'));
    this.sent.push(payment);
    return Promise.resolve();
  }
}

/** Clara, at the made-up Banco Aurora, with an e-mail key. */
export const AURORA_EMAIL = 'clara.aurora@example.com';
export const AURORA_KEY: DictKey = {
  keyType: 'EMAIL',
  bank: { ispb: '99900001', name: 'Banco Aurora' },
  owner: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
};

/** The messages each transaction wrote, in order. */
export class FakeOutbox implements Outbox {
  readonly messages: OutboxMessage[] = [];
  enqueue(_tx: Transaction, message: OutboxMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }
}

/** Always the same id, so tests can expect it. */
export class FixedEndToEndIds implements EndToEndIds {
  next(): string {
    return 'E00000000202610081501a1B2c3D4e5F';
  }
}

/** Payer A (user-a, account-a) and payee B with a CPF key, R$ 100,00 for A. */
export function twoCustomers() {
  const repositories = new FakePaymentsRepositories();
  repositories.addKey('CPF', '12345678909', { accountId: 'account-b', masked: '***.456.789-**' });
  const accounts = new FakeAccounts();
  accounts.accounts.set('account-a', { id: 'account-a', holderUserId: 'user-a', status: 'ACTIVE' });
  accounts.accounts.set('account-b', { id: 'account-b', holderUserId: 'user-b', status: 'ACTIVE' });
  const identity = new FakeIdentity();
  identity.people.set('user-a', { name: 'Ana Souza', documentMasked: '***.444.777-**' });
  identity.people.set('user-b', { name: 'Marina Costa', documentMasked: '***.456.789-**' });
  const ledger = new FakeLedger();
  ledger.balances.set('account-a', Money.of(10_000n));
  return { repositories, accounts, identity, ledger };
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
