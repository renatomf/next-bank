import { describe, expect, it } from 'vitest';
import { CreateCpfKey } from '../../../../src/modules/payments/application/create-cpf-key.ts';
import type {
  PaymentsRepositories,
  PaymentsRepositoriesFactory,
  PixKeyValueProtector,
  ProtectedKeyValue,
} from '../../../../src/modules/payments/application/ports.ts';
import type { PixKeyState, PixKeyType } from '../../../../src/modules/payments/domain/pix-key.ts';
import type { Transaction } from '../../../../src/shared/application/ports.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';

// The CPF Pix key created at registration (domain-model.md 3.4 and 8): the
// value is personal sensitive data, stored only encrypted with a blind index
// (database.md, section 2; API-06). Fictitious CPF only.
const NOW = new Date('2026-10-07T12:00:00.000Z');
const TX: Transaction = { kind: 'transaction' };

/** Not encryption: shows which value and type each call protected. */
class FakeProtector implements PixKeyValueProtector {
  protect(type: PixKeyType, value: string): ProtectedKeyValue {
    return {
      ciphertext: new TextEncoder().encode(`sealed(${type})`),
      blindIndex: this.blindIndex(type, value),
      keyVersion: 1,
    };
  }
  blindIndex(type: PixKeyType, value: string): Uint8Array {
    return new TextEncoder().encode(`index(${type}:${value.length.toString()})`);
  }
  reveal(): string {
    throw new Error('A CPF key is never revealed');
  }
}

class FakeRepositories implements PaymentsRepositoriesFactory {
  inserted: { tx: Transaction; key: PixKeyState; value: ProtectedKeyValue }[] = [];
  for(tx: Transaction): PaymentsRepositories {
    return {
      pixKeys: {
        insert: (key, value) => {
          this.inserted.push({ tx, key, value });
          return Promise.resolve();
        },
        findByIndex: () => Promise.resolve(null),
        insertRandomIfAbsent: () => Promise.resolve(false),
        findRandomOf: () => Promise.resolve(null),
      },
      pixTransfers: {
        insert: () => Promise.resolve(),
        findForPayer: () => Promise.resolve(null),
        lockForPayer: () => Promise.resolve(null),
        update: () => Promise.resolve(),
        findExternalForSending: () => Promise.resolve(null),
        lockByEndToEndId: () => Promise.resolve(null),
        findWaitingForSpi: () => Promise.resolve([]),
      },
      pixSchedules: {
        insert: () => Promise.resolve(),
        findForPayer: () => Promise.resolve(null),
        lockForPayer: () => Promise.resolve(null),
        lockNextDue: () => Promise.resolve(null),
        update: () => Promise.resolve(),
        recordOccurrence: () => Promise.resolve(),
        listForPayer: () => Promise.resolve([]),
        occurrencesOf: () => Promise.resolve([]),
      },
      inbox: { record: () => Promise.resolve(true) },
      idempotency: {
        claim: () => Promise.resolve({ claimed: true }),
        complete: () => Promise.resolve(),
      },
      audit: { record: () => Promise.resolve() },
    };
  }
}

function setup() {
  const repositories = new FakeRepositories();
  const createCpfKey = new CreateCpfKey({
    repositories,
    protector: new FakeProtector(),
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  });
  return { repositories, createCpfKey };
}

describe('CreateCpfKey', () => {
  it("stores the holder's CPF key for the account, in the caller's transaction", async () => {
    const { repositories, createCpfKey } = setup();

    await createCpfKey.execute(TX, { accountId: 'account-1', cpf: Cpf.parse('123.456.789-09') });

    expect(repositories.inserted).toHaveLength(1);
    expect(repositories.inserted[0]?.tx).toBe(TX);
    expect(repositories.inserted[0]?.key).toEqual({
      id: 'id-1',
      accountId: 'account-1',
      type: 'CPF',
      value: '12345678909',
      masked: '***.456.789-**',
      createdAt: NOW,
    });
  });

  it('stores only the protected value and its blind index, never the digits (API-06)', async () => {
    const { repositories, createCpfKey } = setup();

    await createCpfKey.execute(TX, { accountId: 'account-1', cpf: Cpf.parse('123.456.789-09') });

    const value = repositories.inserted[0]?.value;
    expect(new TextDecoder().decode(value?.ciphertext)).toBe('sealed(CPF)');
    expect(new TextDecoder().decode(value?.blindIndex)).toBe('index(CPF:11)');
    expect(value?.keyVersion).toBe(1);
  });
});
