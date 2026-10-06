import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RandomRefreshTokens } from '../../../../src/modules/identity/infrastructure/random-refresh-tokens.ts';

// Refresh tokens: opaque, 256 bits, stored only as a SHA-256 hash
// (ADR 0004, AUTH-03; identity.refresh_tokens.token_hash is 32 bytes).
const refreshTokens = new RandomRefreshTokens();

describe('RandomRefreshTokens', () => {
  it('generates 256 random bits as 43 base64url characters', () => {
    const { token } = refreshTokens.generate();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('never repeats a token', () => {
    const generated = Array.from({ length: 1_000 }, () => refreshTokens.generate().token);

    expect(new Set(generated).size).toBe(generated.length);
  });

  it('stores a 32-byte SHA-256 of the random bytes, never the token itself', () => {
    const { token, hash } = refreshTokens.generate();
    const expected = createHash('sha256').update(Buffer.from(token, 'base64url')).digest();

    expect(Buffer.from(hash).equals(expected)).toBe(true);
    expect(hash).toHaveLength(32);
  });

  it('hashes a presented token the same way it was hashed when issued', () => {
    const { token, hash } = refreshTokens.generate();

    expect(Buffer.from(refreshTokens.hash(token) ?? []).equals(Buffer.from(hash))).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['too short', 'abc'],
    ['too long', 'A'.repeat(44)],
    ['outside base64url', `${'A'.repeat(42)}+`],
    ['padded', `${'A'.repeat(42)}=`],
  ])('refuses a malformed token (%s) before it reaches the database', (_case, token) => {
    expect(refreshTokens.hash(token)).toBeNull();
  });

  it('refuses a non-canonical encoding, so each token has a single valid spelling', () => {
    const { token } = refreshTokens.generate();
    // The last of 43 characters carries 2 unused bits: flipping them decodes to the
    // same bytes, but it is not the string that was issued.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const last = alphabet.indexOf(token.at(-1) ?? 'A');
    const variant = `${token.slice(0, -1)}${alphabet[last ^ 0b01] ?? 'A'}`;

    expect(refreshTokens.hash(variant)).toBeNull();
  });
});
