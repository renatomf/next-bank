import { describe, expect, it } from 'vitest';
import { Argon2idHasher } from '../../../../src/modules/identity/infrastructure/argon2id-hasher.ts';

// Passwords and PINs are stored only as Argon2id hashes (ADR 0004, AUTH-08).
describe('Argon2idHasher', () => {
  const hasher = new Argon2idHasher();

  it('uses Argon2id with the OWASP parameters: 19 MiB, 2 iterations, 1 lane (AUTH-08)', async () => {
    const hash = await hasher.hash('correct horse battery');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('verifies the right secret and refuses a wrong one', async () => {
    const hash = await hasher.hash('correct horse battery');

    await expect(hasher.verify(hash, 'correct horse battery')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'correct horse batterY')).resolves.toBe(false);
  });

  it('salts every hash, so equal secrets do not produce equal hashes', async () => {
    const [first, second] = await Promise.all([hasher.hash('2580'), hasher.hash('2580')]);

    expect(first).not.toBe(second);
  });

  it('never contains the secret', async () => {
    await expect(hasher.hash('correct horse battery')).resolves.not.toContain('correct');
  });
});

// A 4-digit PIN has only 10,000 values: from a leaked database alone, Argon2id
// would fall in minutes. A server-side pepper makes the dump useless (API-13).
describe('Argon2idHasher with a pepper', () => {
  const pepper = new Uint8Array(32).fill(7);
  const peppered = new Argon2idHasher({ pepper });

  it('verifies with the same pepper', async () => {
    const hash = await peppered.hash('2580');

    await expect(peppered.verify(hash, '2580')).resolves.toBe(true);
    await expect(peppered.verify(hash, '2581')).resolves.toBe(false);
  });

  it('cannot be verified without the pepper, as from a database dump (API-13)', async () => {
    const hash = await peppered.hash('2580');

    await expect(new Argon2idHasher().verify(hash, '2580')).resolves.toBe(false);
    await expect(
      new Argon2idHasher({ pepper: new Uint8Array(32).fill(8) }).verify(hash, '2580'),
    ).resolves.toBe(false);
  });

  it('keeps the OWASP parameters', async () => {
    await expect(peppered.hash('2580')).resolves.toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('refuses a pepper that is not 32 bytes', () => {
    expect(() => new Argon2idHasher({ pepper: new Uint8Array(16) })).toThrow(/32 bytes/);
  });
});
