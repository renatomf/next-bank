import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Cpf } from '../../../../src/shared/domain/cpf.ts';
import { AesGcmCpfProtector } from '../../../../src/modules/identity/infrastructure/aes-gcm-cpf-protector.ts';

// CPF is encrypted in the application, so a leaked dump or backup does not
// reveal it (database.md, section 2; API-06). Fictitious textbook CPFs only.
const CPF = Cpf.parse('123.456.789-09');
const OTHER_CPF = Cpf.parse('111.444.777-35');

function newProtector(keys: { encryptionKey?: Buffer; hmacKey?: Buffer } = {}) {
  return new AesGcmCpfProtector({
    keyVersion: 1,
    encryptionKey: keys.encryptionKey ?? randomBytes(32),
    hmacKey: keys.hmacKey ?? randomBytes(32),
  });
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

describe('AesGcmCpfProtector', () => {
  it('encrypts and decrypts back to the same CPF', () => {
    const protector = newProtector();

    const encrypted = protector.encrypt(CPF);

    expect(protector.decrypt(encrypted).digits).toBe(CPF.digits);
    expect(encrypted.keyVersion).toBe(1);
  });

  it('never stores the CPF digits in clear (API-06)', () => {
    const stored = Buffer.from(newProtector().encrypt(CPF).ciphertext);

    expect(stored.includes(Buffer.from(CPF.digits))).toBe(false);
    expect(stored.toString('latin1')).not.toContain('123456789');
  });

  it('produces a different ciphertext each time (random nonce)', () => {
    const protector = newProtector();

    expect(same(protector.encrypt(CPF).ciphertext, protector.encrypt(CPF).ciphertext)).toBe(false);
  });

  it('detects any change to the ciphertext', () => {
    const protector = newProtector();
    const encrypted = protector.encrypt(CPF);
    const tampered = Uint8Array.from(encrypted.ciphertext);
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 0x01;

    expect(() => protector.decrypt({ ...encrypted, ciphertext: tampered })).toThrow();
  });

  it('refuses a stored value too short to hold the full 16-byte tag (truncated tag forgery)', () => {
    const protector = newProtector();
    const encrypted = protector.encrypt(CPF);
    // Nonce plus only 4 bytes of tag: a short tag is far easier to guess.
    const truncated = encrypted.ciphertext.subarray(0, 12 + 4);

    expect(() => protector.decrypt({ ...encrypted, ciphertext: truncated })).toThrow(/too short/);
  });

  it('cannot decrypt with another key', () => {
    const encrypted = newProtector().encrypt(CPF);

    expect(() => newProtector().decrypt(encrypted)).toThrow();
  });

  it('refuses a ciphertext from an unknown key version', () => {
    const protector = newProtector();
    const encrypted = protector.encrypt(CPF);

    expect(() => protector.decrypt({ ...encrypted, keyVersion: 2 })).toThrow(/key version/);
  });

  it('gives a stable 32-byte blind index for uniqueness without the clear CPF (T-DB-11)', () => {
    const hmacKey = randomBytes(32);
    const first = newProtector({ hmacKey }).blindIndex(CPF);

    expect(first).toHaveLength(32);
    expect(same(first, newProtector({ hmacKey }).blindIndex(CPF))).toBe(true);
    expect(same(first, newProtector({ hmacKey }).blindIndex(OTHER_CPF))).toBe(false);
  });

  it('gives a different blind index under another key, so it cannot be precomputed', () => {
    expect(same(newProtector().blindIndex(CPF), newProtector().blindIndex(CPF))).toBe(false);
  });

  it('refuses keys that are not 32 bytes', () => {
    expect(() => newProtector({ encryptionKey: randomBytes(16) })).toThrow(/32 bytes/);
    expect(() => newProtector({ hmacKey: randomBytes(31) })).toThrow(/32 bytes/);
  });
});
