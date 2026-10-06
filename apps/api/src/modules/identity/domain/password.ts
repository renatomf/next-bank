import { WeakPassword } from './errors.ts';

const MIN_LENGTH = 10;
// Upper bound keeps the cost of Argon2id predictable (AUTH-08).
const MAX_LENGTH = 128;

/** Known leaked or common passwords (AUTH-07); the list itself lives outside the domain. */
export interface CommonPasswordList {
  contains(candidate: string): boolean;
}

/**
 * A password that satisfies the policy of ADR 0004: length only, no composition
 * rules, and not a common password. Never printed: only hashed.
 */
export class Password {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string, commonPasswords: CommonPasswordList): Password {
    // NIST SP 800-63B counts each Unicode code point as one character, which is
    // exactly what spreading a string gives (grapheme clusters are not needed).
    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code points are intended
    const length = [...raw].length;
    if (length < MIN_LENGTH || length > MAX_LENGTH) throw new WeakPassword();
    if (commonPasswords.contains(raw.toLowerCase())) throw new WeakPassword();
    return new Password(raw);
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}
