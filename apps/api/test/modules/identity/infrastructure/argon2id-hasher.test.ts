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
