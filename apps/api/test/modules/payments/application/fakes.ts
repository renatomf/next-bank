import type {
  AccountsPort,
  ClaimResult,
  IdempotencyClaim,
  IdempotencyRepository,
  IdentityPort,
  LedgerPort,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PayeeAccount,
  PixKeyValueProtector,
  ProtectedKeyValue,
  RequestFingerprint,
  StoredPixKey,
  StoredResponse,
} from '../../../../src/modules/payments/application/ports.ts';
import type { PixKeyType } from '../../../../src/modules/payments/domain/pix-key.ts';
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

/** Not encryption: shows which value and type each call protected. */
export class FakeKeyProtector implements PixKeyValueProtector {
  protect(type: PixKeyType, value: string): ProtectedKeyValue {
    return {
      ciphertext: new TextEncoder().encode(`sealed(${type})`),
      blindIndex: this.blindIndex(type, value),
      keyVersion: 1,
    };
  }
  blindIndex(type: PixKeyType, value: string): Uint8Array {
    return new TextEncoder().encode(`index(${type}:${value})`);
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
  lookups = 0;

  addKey(type: PixKeyType, value: string, key: StoredPixKey): void {
    this.keys.set(textOf(new FakeKeyProtector().blindIndex(type, value)), key);
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
      },
      pixTransfers: {
        insert: (state) => {
          this.transfers.push(state);
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

export class FakeAccounts implements AccountsPort {
  readonly accounts = new Map<string, PayeeAccount>();
  findById(_tx: Transaction, accountId: string): Promise<PayeeAccount | null> {
    return Promise.resolve(this.accounts.get(accountId) ?? null);
  }
  findByHolder(_tx: Transaction, userId: string): Promise<PayeeAccount | null> {
    return Promise.resolve(
      [...this.accounts.values()].find((account) => account.holderUserId === userId) ?? null,
    );
  }
}

export class FakeIdentity implements IdentityPort {
  readonly people = new Map<string, { name: string; documentMasked: string }>();
  payeeOf(_tx: Transaction, userId: string) {
    return Promise.resolve(this.people.get(userId) ?? null);
  }
}

export class FakeLedger implements LedgerPort {
  readonly balances = new Map<string, Money>();
  availableBalance(_tx: Transaction, accountId: string): Promise<Money | null> {
    return Promise.resolve(this.balances.get(accountId) ?? null);
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
  identity.people.set('user-b', { name: 'Marina Costa', documentMasked: '***.456.789-**' });
  const ledger = new FakeLedger();
  ledger.balances.set('account-a', Money.of(10_000n));
  return { repositories, accounts, identity, ledger };
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
