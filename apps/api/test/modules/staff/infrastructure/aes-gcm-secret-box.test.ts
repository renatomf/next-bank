import { randomBytes } from 'node:crypto';
import { Secret } from 'otpauth';
import { describe, expect, it } from 'vitest';
import { AesGcmSecretBox } from '../../../../src/modules/staff/infrastructure/aes-gcm-secret-box.ts';

// The TOTP secret sealed with its own key (v1.3.0 plan, task 1, S5), with
// the same AES-256-GCM as the CPF: the ciphertext never holds the secret,
// and another key opens nothing.
const SECRET = new Secret({ size: 20 }).base32;

describe('AesGcmSecretBox', () => {
  it('seals a secret and opens it back', () => {
    const box = new AesGcmSecretBox(randomBytes(32));

    const sealed = box.seal(SECRET);

    expect(Buffer.from(sealed.ciphertext).toString('latin1')).not.toContain(SECRET);
    expect(box.open(sealed)).toBe(SECRET);
  });

  it('opens nothing sealed with another key', () => {
    const sealed = new AesGcmSecretBox(randomBytes(32)).seal(SECRET);

    expect(() => new AesGcmSecretBox(randomBytes(32)).open(sealed)).toThrow();
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => new AesGcmSecretBox(randomBytes(16))).toThrow();
  });
});
