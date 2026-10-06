import { hash, verify } from '@node-rs/argon2';
import type { SecretHasher } from '../application/ports.ts';

// OWASP Password Storage Cheat Sheet, minimum for Argon2id (AUTH-08). The
// algorithm is the library's documented default (Argon2id): its const enum
// cannot be read at runtime under verbatimModuleSyntax. The hash prefix test
// checks the algorithm and every parameter.
const PARAMETERS = {
  memoryCost: 19_456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
};
const PEPPER_BYTES = 32;

export class Argon2idHasher implements SecretHasher {
  readonly #options: typeof PARAMETERS & { secret?: Uint8Array };

  /**
   * The pepper is a server-side key mixed into the hash (Argon2 "secret"). Used
   * for the PIN: with only 10,000 values, a leaked database alone would reveal
   * every PIN within minutes; without the pepper it reveals none (API-13).
   */
  constructor(options: { pepper?: Uint8Array } = {}) {
    if (options.pepper !== undefined && options.pepper.length !== PEPPER_BYTES) {
      throw new Error('PIN pepper must be 32 bytes');
    }
    this.#options =
      options.pepper === undefined ? PARAMETERS : { ...PARAMETERS, secret: options.pepper };
  }

  hash(secret: string): Promise<string> {
    return hash(secret, this.#options);
  }

  /** Parameters are read from the stored hash, so older hashes still verify after a change. */
  verify(storedHash: string, secret: string): Promise<boolean> {
    return verify(
      storedHash,
      secret,
      this.#options.secret === undefined ? undefined : { secret: this.#options.secret },
    );
  }
}
