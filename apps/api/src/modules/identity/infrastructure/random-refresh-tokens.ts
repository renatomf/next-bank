import { createHash, randomBytes } from 'node:crypto';
import type { RefreshTokenGenerator } from '../application/ports.ts';

const TOKEN_BYTES = 32; // 256 bits (ADR 0004)
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/**
 * Opaque refresh tokens (AUTH-03). High entropy makes a plain SHA-256 enough
 * for storage: there is nothing to guess, unlike a password.
 */
export class RandomRefreshTokens implements RefreshTokenGenerator {
  generate(): { token: string; hash: Uint8Array } {
    const bytes = randomBytes(TOKEN_BYTES);
    return { token: bytes.toString('base64url'), hash: sha256(bytes) };
  }

  hash(token: string): Uint8Array | null {
    if (!TOKEN_FORMAT.test(token)) return null;
    const bytes = Buffer.from(token, 'base64url');
    // The last character has 2 unused bits: only the exact spelling issued is valid.
    if (bytes.length !== TOKEN_BYTES || bytes.toString('base64url') !== token) return null;
    return sha256(bytes);
  }
}

function sha256(bytes: Uint8Array): Uint8Array {
  return createHash('sha256').update(bytes).digest();
}
