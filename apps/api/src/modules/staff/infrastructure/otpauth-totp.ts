import { Secret, TOTP } from 'otpauth';
import type { TotpVerifier } from '../application/ports.ts';

// What every authenticator app reads by default (S3).
const ALGORITHM = 'SHA1';
const DIGITS = 6;
const PERIOD_SECONDS = 30;
/** One step before and one after: the phone's clock may drift a little. */
const WINDOW = 1;
const SECRET_BYTES = 20; // 160 bits, as RFC 4226 recommends
const ISSUER = 'next bank equipe';
const CODE = /^\d{6}$/;

/** TOTP (RFC 6238) for the staff's login, over the otpauth library (v1.3.0 plan, task 1). */
export class OtpauthTotp implements TotpVerifier {
  stepOf(secret: string, code: string, now: Date): number | null {
    if (!CODE.test(code)) return null;
    const timestamp = now.getTime();
    const delta = this.#totp(secret).validate({ token: code, timestamp, window: WINDOW });
    if (delta === null) return null;
    return Math.floor(timestamp / 1000 / PERIOD_SECONDS) + delta;
  }

  newSecret(): string {
    return new Secret({ size: SECRET_BYTES }).base32;
  }

  uriFor(secret: string, account: string): string {
    return this.#totp(secret, account).toString();
  }

  #totp(secret: string, label?: string): TOTP {
    return new TOTP({
      issuer: ISSUER,
      ...(label === undefined ? {} : { label }),
      secret: Secret.fromBase32(secret),
      algorithm: ALGORITHM,
      digits: DIGITS,
      period: PERIOD_SECONDS,
    });
  }
}
