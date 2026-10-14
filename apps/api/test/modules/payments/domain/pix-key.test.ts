import { describe, expect, it } from 'vitest';
import { PixKeyNotFound } from '../../../../src/modules/payments/domain/errors.ts';
import { PixKey, pixKeyValue } from '../../../../src/modules/payments/domain/pix-key.ts';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';

// Pix key (domain-model.md 3.4). Every customer has the CPF of the account
// holder, created at registration, and since v1.1.0 a random key to receive by
// QR Code. Fictitious CPFs only.
const NOW = new Date('2026-10-07T12:00:00.000Z');
const HOLDER_CPF = Cpf.parse('123.456.789-09');
const RANDOM_VALUE = '1b2c3d4e-5f6a-4b7c-8d9e-0a1b2c3d9f0a';

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

  // The key a customer shares to receive: never the CPF (PIX-12, v1.1.0 plan, task 3).
  it('is a random UUID v4, shown with only its ends', () => {
    const key = PixKey.random({
      id: 'key-2',
      accountId: 'account-1',
      value: RANDOM_VALUE,
      now: NOW,
    });

    expect(key.state).toEqual({
      id: 'key-2',
      accountId: 'account-1',
      type: 'RANDOM',
      value: RANDOM_VALUE,
      masked: '1b2c****-****-****-****-********9f0a',
      createdAt: NOW,
    });
  });

  it('keeps a random value in lowercase', () => {
    const key = PixKey.random({
      id: 'key-2',
      accountId: 'account-1',
      value: RANDOM_VALUE.toUpperCase(),
      now: NOW,
    });

    expect(key.state.value).toBe(RANDOM_VALUE);
  });

  // A UUID v7 carries its creation time: wiring the id generator here is a bug.
  it.each([
    ['a UUID v7', '019a0b6e-7c3d-7f00-8a1b-2c3d4e5f6a7b'],
    ['text that is not a UUID', 'not-a-uuid'],
  ])('refuses %s as a random value', (_case, value) => {
    expect(() => PixKey.random({ id: 'key-2', accountId: 'account-1', value, now: NOW })).toThrow(
      'Random Pix key must be a UUID v4',
    );
  });
});

describe('pixKeyValue', () => {
  it('normalizes a CPF typed with or without punctuation', () => {
    expect(pixKeyValue('CPF', '123.456.789-09')).toBe('12345678909');
    expect(pixKeyValue('CPF', '12345678909')).toBe('12345678909');
  });

  it('normalizes a random key to lowercase, without blanks around it', () => {
    expect(pixKeyValue('RANDOM', ` ${RANDOM_VALUE.toUpperCase()} `)).toBe(RANDOM_VALUE);
  });

  // No key can exist for these, so the lookup answers as for any unknown key.
  it.each([
    ['a CPF with a wrong check digit', 'CPF', '123.456.789-00'],
    ['text that is not a CPF', 'CPF', 'ana@example.test'],
    ['a key type V1 does not register', 'EMAIL', 'ana@example.test'],
    ['a random key that is not a UUID v4', 'RANDOM', '019a0b6e-7c3d-7f00-8a1b-2c3d4e5f6a7b'],
    ['a random key with a CPF', 'RANDOM', '12345678909'],
  ])('finds no key for %s (PixKeyNotFound)', (_case, type, raw) => {
    expect(() => pixKeyValue(type as 'CPF', raw)).toThrow(PixKeyNotFound);
  });
});
