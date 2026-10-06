import { createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader, SignJWT, UnsecuredJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { Unauthenticated } from '../../../../src/modules/identity/domain/errors.ts';
import { JoseAccessTokens } from '../../../../src/modules/identity/infrastructure/jose-access-tokens.ts';

// Access tokens (ADR 0004, threat model D4/D5, AUTH-04, AUTH-05).
const NOW = new Date('2026-10-06T12:00:00.000Z');
const SECONDS = (date: Date) => Math.floor(date.getTime() / 1000);
const KEY_ID = 'key-2026-10';

function newKey(): KeyObject {
  return generateKeyPairSync('ed25519').privateKey;
}

const privateKey = newKey();
const tokens = new JoseAccessTokens({ privateKey, keyId: KEY_ID });

function at(offsetSeconds: number): Date {
  return new Date(NOW.getTime() + offsetSeconds * 1000);
}

async function issue(): Promise<string> {
  const { token } = await tokens.issue({ userId: 'user-1', sessionId: 'session-1', now: NOW });
  return token;
}

/** Builds a token with any header and claims, signed with the given key. */
function forge(
  claims: Record<string, unknown>,
  header: Record<string, unknown>,
  key: KeyObject | Uint8Array = privateKey,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'at+jwt', kid: KEY_ID, ...header })
    .sign(key);
}

const VALID_CLAIMS = {
  iss: 'next-bank-api',
  aud: 'next-bank-app',
  sub: 'user-1',
  sid: 'session-1',
  iat: SECONDS(NOW),
  nbf: SECONDS(NOW),
  exp: SECONDS(NOW) + 15 * 60,
};

async function expectRefused(token: string, now: Date = NOW): Promise<void> {
  await expect(tokens.verify(token, now)).rejects.toThrow(Unauthenticated);
}

describe('JoseAccessTokens', () => {
  describe('issue', () => {
    it('signs with EdDSA, names the key and declares an access token (RFC 9068)', async () => {
      expect(decodeProtectedHeader(await issue())).toEqual({
        alg: 'EdDSA',
        kid: KEY_ID,
        typ: 'at+jwt',
      });
    });

    it('carries the issuer, audience, user, session and a 15-minute validity (D5)', async () => {
      expect(decodeJwt(await issue())).toEqual(VALID_CLAIMS);
    });

    it('reports when the token expires', async () => {
      const { expiresAt } = await tokens.issue({ userId: 'u', sessionId: 's', now: NOW });

      expect(expiresAt).toEqual(at(15 * 60));
    });
  });

  describe('verify', () => {
    it('accepts its own token and returns the user and session', async () => {
      await expect(tokens.verify(await issue(), NOW)).resolves.toEqual({
        userId: 'user-1',
        sessionId: 'session-1',
      });
    });

    it('accepts it until the last second and refuses it at 15 minutes (AUTH-04)', async () => {
      const token = await issue();

      await expect(tokens.verify(token, at(15 * 60 - 1))).resolves.toBeDefined();
      await expectRefused(token, at(15 * 60));
    });

    it('refuses an unsigned token (alg: none, AUTH-05)', async () => {
      await expectRefused(new UnsecuredJWT(VALID_CLAIMS).encode());
    });

    it('refuses an HMAC token signed with the public key as secret (algorithm confusion, AUTH-05)', async () => {
      const publicKeyBytes = createPublicKey(privateKey).export({ format: 'der', type: 'spki' });

      await expectRefused(await forge(VALID_CLAIMS, { alg: 'HS256' }, publicKeyBytes));
    });

    it('refuses a token signed by another key (AUTH-05)', async () => {
      await expectRefused(await forge(VALID_CLAIMS, {}, newKey()));
    });

    it('refuses a token whose payload was changed after signing', async () => {
      const [header, , signature] = (await issue()).split('.');
      const payload = Buffer.from(JSON.stringify({ ...VALID_CLAIMS, sub: 'user-2' })).toString(
        'base64url',
      );

      await expectRefused(`${String(header)}.${payload}.${String(signature)}`);
    });

    it.each([
      ['another issuer', { iss: 'someone-else' }],
      ['another audience', { aud: 'backoffice' }],
      ['a future not-before', { nbf: SECONDS(NOW) + 60 }],
      ['no expiration', { exp: undefined }],
      ['no not-before', { nbf: undefined }],
      ['no issued-at', { iat: undefined }],
      ['no user', { sub: undefined }],
      ['no session', { sid: undefined }],
      ['a non-string session', { sid: 42 }],
    ])('refuses a token with %s (AUTH-05)', async (_case, change) => {
      await expectRefused(await forge({ ...VALID_CLAIMS, ...change }, {}));
    });

    it.each([
      ['no key id', { kid: undefined }],
      ['an unknown key id', { kid: 'key-1999-01' }],
      ['another token type', { typ: 'JWT' }],
    ])('refuses a token with %s', async (_case, header) => {
      await expectRefused(await forge(VALID_CLAIMS, header));
    });

    it('refuses something that is not a token at all', async () => {
      await expectRefused('not-a-token');
      await expectRefused('');
    });
  });

  it('refuses a private key that is not Ed25519', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

    expect(() => new JoseAccessTokens({ privateKey: rsa, keyId: KEY_ID })).toThrow(/Ed25519/);
  });
});
