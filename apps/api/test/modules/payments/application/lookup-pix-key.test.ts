import { describe, expect, it } from 'vitest';
import { LookupPixKey } from '../../../../src/modules/payments/application/lookup-pix-key.ts';
import {
  PixKeyNotFound,
  TooManyKeyLookups,
} from '../../../../src/modules/payments/domain/errors.ts';
import { InMemoryKeyLookupQuota } from '../../../../src/modules/payments/infrastructure/in-memory-key-lookup-quota.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import {
  FakeAccounts,
  FakeIdentity,
  FakeKeyProtector,
  FakePaymentsRepositories,
  FakeUnitOfWork,
} from './fakes.ts';

// Pix key lookup (domain-model.md 7 and 11, screen 7; PIX-07): the payer sees
// who receives before typing the amount, never the full CPF, and a customer
// cannot sweep keys to collect names. Fictitious CPFs only.
const NOW = new Date('2026-10-07T12:00:00.000Z');
const PAYEE_CPF = '12345678909';

function setup() {
  const repositories = new FakePaymentsRepositories();
  repositories.addKey('CPF', PAYEE_CPF, { accountId: 'account-b', masked: '***.456.789-**' });
  const accounts = new FakeAccounts();
  accounts.accounts.set('account-b', { id: 'account-b', holderUserId: 'user-b', status: 'ACTIVE' });
  const identity = new FakeIdentity();
  identity.people.set('user-b', { name: 'Marina Costa', documentMasked: '***.456.789-**' });
  const clock = new FixedClock(NOW);
  const lookup = new LookupPixKey({
    unitOfWork: new FakeUnitOfWork(),
    repositories,
    protector: new FakeKeyProtector(),
    accounts,
    identity,
    quota: new InMemoryKeyLookupQuota(),
    clock,
  });
  return { repositories, clock, lookup };
}

const byCpf = (value: string, customerId = 'user-a') => ({
  customerId,
  type: 'CPF' as const,
  value,
});

describe('LookupPixKey', () => {
  it('shows the payee by full name and masked document, as on the receipt (D6)', async () => {
    const { lookup } = setup();

    await expect(lookup.execute(byCpf('123.456.789-09'))).resolves.toEqual({
      keyType: 'CPF',
      keyMasked: '***.456.789-**',
      payeeName: 'Marina Costa',
      payeeDocumentMasked: '***.456.789-**',
    });
  });

  it('finds no key for a CPF nobody registered (PixKeyNotFound)', async () => {
    const { lookup } = setup();

    await expect(lookup.execute(byCpf('111.444.777-35'))).rejects.toThrow(PixKeyNotFound);
  });

  it('answers an invalid CPF as not found, without reading the database', async () => {
    const { repositories, lookup } = setup();

    await expect(lookup.execute(byCpf('123.456.789-00'))).rejects.toThrow(PixKeyNotFound);
    expect(repositories.lookups).toBe(0);
  });

  it('allows 30 lookups an hour, then refuses the 31st (TooManyAttempts, PIX-07)', async () => {
    const { lookup } = setup();
    for (let i = 0; i < 30; i++) await lookup.execute(byCpf(PAYEE_CPF));

    await expect(lookup.execute(byCpf(PAYEE_CPF))).rejects.toThrow(TooManyKeyLookups);
  });

  it('counts a lookup of a key that does not exist twice', async () => {
    const { lookup } = setup();
    for (let i = 0; i < 15; i++) {
      await expect(lookup.execute(byCpf('111.444.777-35'))).rejects.toThrow(PixKeyNotFound);
    }

    await expect(lookup.execute(byCpf(PAYEE_CPF))).rejects.toThrow(TooManyKeyLookups);
  });

  it('keeps one quota per customer and renews it after an hour', async () => {
    const { clock, lookup } = setup();
    for (let i = 0; i < 30; i++) await lookup.execute(byCpf(PAYEE_CPF));

    await expect(lookup.execute(byCpf(PAYEE_CPF, 'user-c'))).resolves.toBeDefined();
    clock.current = new Date('2026-10-07T13:00:00.000Z');
    await expect(lookup.execute(byCpf(PAYEE_CPF))).resolves.toBeDefined();
  });

  // F-11: the quota is taken before any await, so parallel lookups cannot overrun it.
  it('never serves more than 30 lookups fired at once', async () => {
    const { lookup } = setup();

    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () => lookup.execute(byCpf(PAYEE_CPF))),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(30);
  });
});
