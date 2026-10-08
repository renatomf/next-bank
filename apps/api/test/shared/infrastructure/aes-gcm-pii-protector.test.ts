import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AesGcmPiiProtector } from '../../../src/shared/infrastructure/aes-gcm-pii-protector.ts';

// Personal sensitive data (a CPF, a Pix key) is encrypted in the application,
// so a leaked dump or backup does not reveal it (database.md, section 2;
// API-06). Each purpose binds its own values (week 5 plan, D7).
const PIX_KEY = { associatedData: 'payments.pix_keys.value', indexPrefix: 'pix-key:CPF' };
const USER_CPF = { associatedData: 'identity.users.cpf', indexPrefix: 'cpf' };
const VALUE = '12345678909';

function keys(overrides: { encryptionKey?: Buffer; hmacKey?: Buffer } = {}) {
  return {
    keyVersion: 1,
    encryptionKey: overrides.encryptionKey ?? randomBytes(32),
    hmacKey: overrides.hmacKey ?? randomBytes(32),
  };
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

describe('AesGcmPiiProtector', () => {
  it('encrypts and decrypts back to the same value', () => {
    const protector = new AesGcmPiiProtector(keys(), PIX_KEY);

    const encrypted = protector.encrypt(VALUE);

    expect(protector.decrypt(encrypted)).toBe(VALUE);
    expect(encrypted.keyVersion).toBe(1);
  });

  it('never stores the value in clear (API-06)', () => {
    const stored = Buffer.from(new AesGcmPiiProtector(keys(), PIX_KEY).encrypt(VALUE).ciphertext);

    expect(stored.includes(Buffer.from(VALUE))).toBe(false);
  });

  it('produces a different ciphertext each time (random nonce)', () => {
    const protector = new AesGcmPiiProtector(keys(), PIX_KEY);

    expect(same(protector.encrypt(VALUE).ciphertext, protector.encrypt(VALUE).ciphertext)).toBe(
      false,
    );
  });

  it('detects any change to the ciphertext', () => {
    const protector = new AesGcmPiiProtector(keys(), PIX_KEY);
    const encrypted = protector.encrypt(VALUE);
    const tampered = Uint8Array.from(encrypted.ciphertext);
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 0x01;

    expect(() => protector.decrypt({ ...encrypted, ciphertext: tampered })).toThrow();
  });

  it('refuses a stored value too short to hold the full 16-byte tag', () => {
    const protector = new AesGcmPiiProtector(keys(), PIX_KEY);
    const encrypted = protector.encrypt(VALUE);

    expect(() =>
      protector.decrypt({ ...encrypted, ciphertext: encrypted.ciphertext.subarray(0, 16) }),
    ).toThrow(/too short/);
  });

  it('cannot decrypt with another key or an unknown key version', () => {
    const encrypted = new AesGcmPiiProtector(keys(), PIX_KEY).encrypt(VALUE);

    expect(() => new AesGcmPiiProtector(keys(), PIX_KEY).decrypt(encrypted)).toThrow();
    expect(() =>
      new AesGcmPiiProtector(keys(), PIX_KEY).decrypt({ ...encrypted, keyVersion: 2 }),
    ).toThrow(/key version/);
  });

  it('cannot pass a value encrypted for one purpose off as another', () => {
    const shared = keys();
    const encrypted = new AesGcmPiiProtector(shared, USER_CPF).encrypt(VALUE);

    expect(() => new AesGcmPiiProtector(shared, PIX_KEY).decrypt(encrypted)).toThrow();
  });

  it('gives a stable 32-byte blind index, different for each purpose', () => {
    const shared = keys();
    const index = new AesGcmPiiProtector(shared, PIX_KEY).blindIndex(VALUE);

    expect(index).toHaveLength(32);
    expect(same(index, new AesGcmPiiProtector(shared, PIX_KEY).blindIndex(VALUE))).toBe(true);
    expect(same(index, new AesGcmPiiProtector(shared, PIX_KEY).blindIndex('11144477735'))).toBe(
      false,
    );
    // The same CPF as a user and as a Pix key never shares an index.
    expect(same(index, new AesGcmPiiProtector(shared, USER_CPF).blindIndex(VALUE))).toBe(false);
  });

  it('gives a different blind index under another key, so it cannot be precomputed', () => {
    expect(
      same(
        new AesGcmPiiProtector(keys(), PIX_KEY).blindIndex(VALUE),
        new AesGcmPiiProtector(keys(), PIX_KEY).blindIndex(VALUE),
      ),
    ).toBe(false);
  });

  it('refuses keys that are not 32 bytes', () => {
    expect(() => new AesGcmPiiProtector(keys({ encryptionKey: randomBytes(16) }), PIX_KEY)).toThrow(
      /32 bytes/,
    );
    expect(() => new AesGcmPiiProtector(keys({ hmacKey: randomBytes(31) }), PIX_KEY)).toThrow(
      /32 bytes/,
    );
  });
});
