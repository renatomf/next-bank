import { Secret } from 'otpauth';
import { describe, expect, it } from 'vitest';
import { OtpauthTotp } from '../../../../src/modules/staff/infrastructure/otpauth-totp.ts';

// The staff's TOTP over otpauth (v1.3.0 plan, task 1, S3): SHA-1, 30 s and 6
// digits, one step of tolerance each way, and the step of the code answered
// so a code works once. The secret of RFC 6238's test vectors is the ASCII
// "12345678901234567890", which the authenticators read in base32.
const RFC_SECRET = Secret.fromLatin1('12345678901234567890').base32;
const totp = new OtpauthTotp();
const at = (seconds: number) => new Date(seconds * 1000);

describe('OtpauthTotp', () => {
  it('takes the code of RFC 6238 at T = 59 s, in its step', () => {
    // The vector's 8 digits are 94287082; 6 digits keep the last six.
    expect(totp.stepOf(RFC_SECRET, '287082', at(59))).toBe(1);
  });

  it('takes the code of the step before and of the step after, and no further', () => {
    const code = '287082'; // step 1, from 30 s to 59 s
    expect(totp.stepOf(RFC_SECRET, code, at(60 + 15))).toBe(1);
    expect(totp.stepOf(RFC_SECRET, code, at(5))).toBe(1);
    expect(totp.stepOf(RFC_SECRET, code, at(90 + 15))).toBeNull();
  });

  it.each(['000000', '28708', '2870820', 'abcdef', ''])('refuses the code %s', (code) => {
    expect(totp.stepOf(RFC_SECRET, code, at(59))).toBeNull();
  });

  it('draws a new secret of 160 bits in base32, and its otpauth link', () => {
    const secret = totp.newSecret();

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(totp.newSecret()).not.toBe(secret);
    expect(totp.uriFor(secret, 'lia@example.com')).toBe(
      `otpauth://totp/next%20bank%20equipe:lia%40example.com?issuer=next%20bank%20equipe&secret=${secret}&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
