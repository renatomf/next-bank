import { describe, expect, it } from 'vitest';
import { PixKeyNotFound } from '../../../../src/modules/payments/domain/errors.ts';
import { PixKey, pixKeyValue } from '../../../../src/modules/payments/domain/pix-key.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';

// Pix key (domain-model.md 3.4). In V1 every customer has exactly one key: the
// CPF of the account holder, created at registration. Fictitious CPFs only.
const NOW = new Date('2026-10-07T12:00:00.000Z');
const HOLDER_CPF = Cpf.parse('123.456.789-09');

describe('PixKey', () => {
  it("is the holder's CPF, stored as digits and shown masked", () => {
    const key = PixKey.forHolderCpf({
      id: 'key-1',
      accountId: 'account-1',
      cpf: HOLDER_CPF,
      now: NOW,
    });

    expect(key.state).toEqual({
      id: 'key-1',
      accountId: 'account-1',
      type: 'CPF',
      value: '12345678909',
      masked: '***.456.789-**',
      createdAt: NOW,
    });
  });
});

describe('pixKeyValue', () => {
  it('normalizes a CPF typed with or without punctuation', () => {
    expect(pixKeyValue('CPF', '123.456.789-09')).toBe('12345678909');
    expect(pixKeyValue('CPF', '12345678909')).toBe('12345678909');
  });

  // No key can exist for these, so the lookup answers as for any unknown key.
  it.each([
    ['a CPF with a wrong check digit', 'CPF', '123.456.789-00'],
    ['text that is not a CPF', 'CPF', 'ana@example.test'],
    ['a key type V1 does not register', 'EMAIL', 'ana@example.test'],
  ])('finds no key for %s (PixKeyNotFound)', (_case, type, raw) => {
    expect(() => pixKeyValue(type as 'CPF', raw)).toThrow(PixKeyNotFound);
  });
});
