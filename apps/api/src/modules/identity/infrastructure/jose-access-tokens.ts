import { createPublicKey, type KeyObject } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { AccessTokenIssuer, AccessTokenVerifier } from '../application/ports.ts';
import { Unauthenticated } from '../domain/errors.ts';

const ALGORITHM = 'EdDSA';
// RFC 9068: an explicit type keeps other JWTs from being accepted as access tokens.
const TOKEN_TYPE = 'at+jwt';
const ISSUER = 'next-bank-api';
const AUDIENCE = 'next-bank-app';
const LIFETIME_SECONDS = 15 * 60;

export interface AccessTokenKeys {
  /** Ed25519 private key (JWT_PRIVATE_KEY). */
  privateKey: KeyObject;
  /** Published in the header, so a key can be replaced without guessing (JWT_KEY_ID). */
  keyId: string;
}

/**
 * Issues and verifies access tokens (ADR 0004, threat model D4). Verification
 * accepts only EdDSA, only this key id and only complete claims (AUTH-05). No
 * clock tolerance: the same service issues and verifies.
 */
export class JoseAccessTokens implements AccessTokenIssuer, AccessTokenVerifier {
  readonly #privateKey: KeyObject;
  readonly #publicKey: KeyObject;
  readonly #keyId: string;

  constructor({ privateKey, keyId }: AccessTokenKeys) {
    if (privateKey.asymmetricKeyType !== 'ed25519') {
      throw new Error('Access token key must be an Ed25519 private key');
    }
    this.#privateKey = privateKey;
    this.#publicKey = createPublicKey(privateKey);
    this.#keyId = keyId;
  }

  async issue(input: {
    userId: string;
    sessionId: string;
    now: Date;
  }): Promise<{ token: string; expiresAt: Date }> {
    const issuedAt = Math.floor(input.now.getTime() / 1000);
    const expiresAt = issuedAt + LIFETIME_SECONDS;
    const token = await new SignJWT({ sid: input.sessionId })
      .setProtectedHeader({ alg: ALGORITHM, kid: this.#keyId, typ: TOKEN_TYPE })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(input.userId)
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.#privateKey);
    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string, now: Date): Promise<{ userId: string; sessionId: string }> {
    try {
      const { payload } = await jwtVerify(
        token,
        (header) => {
          // Only the configured key; the algorithm list below rejects everything else.
          if (header.kid !== this.#keyId) throw new Unauthenticated();
          return this.#publicKey;
        },
        {
          algorithms: [ALGORITHM],
          typ: TOKEN_TYPE,
          issuer: ISSUER,
          audience: AUDIENCE,
          currentDate: now,
          clockTolerance: 0,
          requiredClaims: ['iat', 'nbf', 'exp', 'sub', 'sid'],
        },
      );
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Unauthenticated();
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof Unauthenticated || error instanceof errors.JOSEError) {
        throw new Unauthenticated();
      }
      throw error;
    }
  }
}
