import { describe, expect, it } from 'vitest';
import { LookupPixKey } from '../../../../src/modules/payments/application/lookup-pix-key.ts';
import {
  PixKeyNotFound,
  TooManyKeyLookups,
} from '../../../../src/modules/payments/domain/errors.ts';
import { InMemoryKeyLookupQuota } from '../../../../src/modules/payments/infrastructure/in-memory-key-lookup-quota.ts';
import { FixedClock } from '../../identity/application/fakes.ts';
import {
  AURORA_EMAIL,
  AURORA_KEY,
  FakeAccounts,
  FakeIdentity,
  FakeKeyProtector,
  FakePaymentsRepositories,
  FakeSpi,
  FakeUnitOfWork,
} from './fakes.ts';

// Pix key lookup (domain-model.md 7 and 11, screen 7; PIX-07): the payer sees
// who receives before typing the amount, never the full CPF, and a customer
// cannot sweep keys to collect names. Fictitious CPFs only.
const NOW = new Date('2026-10-07T12:00:00.000Z');
const PAYEE_CPF = '12345678909';

function setup(options: { externalPix?: boolean } = {}) {
  const repositories = new FakePaymentsRepositories();
  repositories.addKey('CPF', PAYEE_CPF, { accountId: 'account-b', masked: '***.456.789-**' });
  const accounts = new FakeAccounts();
  accounts.accounts.set('account-b', { id: 'account-b', holderUserId: 'user-b', status: 'ACTIVE' });
  const identity = new FakeIdentity();
  identity.people.set('user-b', { name: 'Marina Costa', documentMasked: '***.456.789-**' });
  const clock = new FixedClock(NOW);
  const spi = new FakeSpi();
  spi.keys.set(AURORA_EMAIL, AURORA_KEY);
  spi.keys.set('31840725680', { ...AURORA_KEY, keyType: 'CPF' });
  const lookup = new LookupPixKey({
    unitOfWork: new FakeUnitOfWork(),
    repositories,
    protector: new FakeKeyProtector(),
    accounts,
    identity,
    quota: new InMemoryKeyLookupQuota(),
    clock,
    // Off in production until task 4 (P1): then no lookup reaches the DICT.
    spi: options.externalPix === false ? null : spi,
  });
  return { repositories, clock, spi, lookup };
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

  // Keys of other banks (v1.2.0 plan, task 3): asked of the DICT when next
  // bank does not hold them, with the same quota (PIX-07).
  describe('at another bank', () => {
    const byEmail = (value: string) => ({ customerId: 'user-a', type: 'EMAIL' as const, value });

    it('shows the payee found in the DICT, with the bank and the key masked', async () => {
      const { spi, lookup } = setup();

      await expect(lookup.execute(byEmail(' Clara.Aurora@Example.com '))).resolves.toEqual({
        keyType: 'EMAIL',
        keyMasked: 'cl***@example.com',
        payeeName: 'Clara Aurora Teixeira',
        payeeDocumentMasked: '***.407.256-**',
        bank: { ispb: '99900001', name: 'Banco Aurora' },
      });
      expect(spi.lookups).toEqual([AURORA_EMAIL]);
    });

    it('never asks the DICT for a key next bank holds', async () => {
      const { spi, lookup } = setup();

      await lookup.execute(byCpf(PAYEE_CPF));

      expect(spi.lookups).toEqual([]);
    });

    it('asks the DICT for a CPF next bank does not hold', async () => {
      const { lookup } = setup();

      await expect(lookup.execute(byCpf('318.407.256-80'))).resolves.toMatchObject({
        keyMasked: '***.407.256-**',
        bank: { name: 'Banco Aurora' },
      });
    });

    it('finds nothing when the DICT holds the value under another type', async () => {
      const { spi, lookup } = setup();
      spi.keys.set('+5511900009001', AURORA_KEY);

      await expect(
        lookup.execute({ customerId: 'user-a', type: 'PHONE', value: '11 90000-9001' }),
      ).rejects.toThrow(PixKeyNotFound);
    });

    it('never asks the DICT for a value no key can have', async () => {
      const { spi, lookup } = setup();

      await expect(lookup.execute(byEmail('clara@'))).rejects.toThrow(PixKeyNotFound);
      expect(spi.lookups).toEqual([]);
    });

    it('never asks the DICT while the Pix to other banks is off (P1)', async () => {
      const { spi, lookup } = setup({ externalPix: false });

      await expect(lookup.execute(byEmail(AURORA_EMAIL))).rejects.toThrow(PixKeyNotFound);
      expect(spi.lookups).toEqual([]);
    });

    it('spends the same quota, and a key no bank holds costs twice', async () => {
      const { lookup } = setup();
      for (let i = 0; i < 10; i++) await lookup.execute(byEmail(AURORA_EMAIL));
      for (let i = 0; i < 10; i++) {
        await expect(lookup.execute(byEmail('ninguem@example.com'))).rejects.toThrow(
          PixKeyNotFound,
        );
      }

      await expect(lookup.execute(byEmail(AURORA_EMAIL))).rejects.toThrow(TooManyKeyLookups);
    });

    // A partner that does not answer is not a missing key: nothing is charged twice.
    it('fails when the DICT does not answer, without counting a miss', async () => {
      const { spi, lookup } = setup();
      spi.down = true;
      for (let i = 0; i < 15; i++) {
        await expect(lookup.execute(byEmail(AURORA_EMAIL))).rejects.toThrow(/unreachable/);
      }
      spi.down = false;

      await expect(lookup.execute(byEmail(AURORA_EMAIL))).resolves.toBeDefined();
    });
  });
});
