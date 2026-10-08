import { randomInt } from 'node:crypto';
import type { EndToEndIds } from '../application/ports.ts';
import { endToEndId } from '../domain/end-to-end-id.ts';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const RANDOM_LENGTH = 11;

/** End-to-end ids with 11 letters or digits from a cryptographic source (D10). */
export class CryptoEndToEndIds implements EndToEndIds {
  next(completedAt: Date): string {
    const random = Array.from(
      { length: RANDOM_LENGTH },
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join('');
    return endToEndId(completedAt, random);
  }
}
