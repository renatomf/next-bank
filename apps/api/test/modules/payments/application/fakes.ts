import type {
  AccountsPort,
  IdentityPort,
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PayeeAccount,
  PixKeyValueProtector,
  ProtectedKeyValue,
  StoredPixKey,
} from '../../../../src/modules/payments/application/ports.ts';
import type { PixKeyType } from '../../../../src/modules/payments/domain/pix-key.ts';
import type { Transaction, UnitOfWork } from '../../../../src/shared/application/ports.ts';

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

/** Pix keys kept by their fake blind index. */
export class FakePaymentsRepositories implements PaymentsRepositoriesFactory {
  readonly keys = new Map<string, StoredPixKey>();
  lookups = 0;

  addKey(type: PixKeyType, value: string, key: StoredPixKey): void {
    this.keys.set(indexKey(new FakeKeyProtector().blindIndex(type, value)), key);
  }

  for(): PaymentsRepositories {
    return {
      pixKeys: {
        insert: () => Promise.resolve(),
        findByIndex: (_type, blindIndex) => {
          this.lookups += 1;
          return Promise.resolve(this.keys.get(indexKey(blindIndex)) ?? null);
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
}

export class FakeIdentity implements IdentityPort {
  readonly people = new Map<string, { name: string; documentMasked: string }>();
  payeeOf(_tx: Transaction, userId: string) {
    return Promise.resolve(this.people.get(userId) ?? null);
  }
}

function indexKey(index: Uint8Array): string {
  return new TextDecoder().decode(index);
}
