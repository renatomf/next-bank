import { hash, verify } from '@node-rs/argon2';
import type { SecretHasher } from '../application/ports.ts';

// OWASP Password Storage Cheat Sheet, minimum for Argon2id (AUTH-08). The
// algorithm is the library's documented default (Argon2id): its const enum
// cannot be read at runtime under verbatimModuleSyntax. The hash prefix test
// checks the algorithm and every parameter.
const OPTIONS = {
  memoryCost: 19_456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export class Argon2idHasher implements SecretHasher {
  hash(secret: string): Promise<string> {
    return hash(secret, OPTIONS);
  }

  /** Parameters are read from the stored hash, so older hashes still verify after a change. */
  verify(storedHash: string, secret: string): Promise<boolean> {
    return verify(storedHash, secret);
  }
}
