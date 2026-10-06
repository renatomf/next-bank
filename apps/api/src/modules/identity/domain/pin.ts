import { InvalidPin } from './errors.ts';

// ASCII digits only: \d would also match other scripts' digits.
const FOUR_DIGITS = /^[0-9]{4}$/;
const REPEATED_DIGITS = /^(\d)\1{3}$/;
const ASCENDING = '0123456789';
const DESCENDING = '9876543210';

/** A transaction PIN chosen by the client. Never printed: only hashed. */
export class Pin {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): Pin {
    if (!FOUR_DIGITS.test(raw) || isTrivial(raw)) throw new InvalidPin();
    return new Pin(raw);
  }

  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }
}

// The first guesses of anyone trying PINs: 0000, 1234, 9876...
function isTrivial(pin: string): boolean {
  return REPEATED_DIGITS.test(pin) || ASCENDING.includes(pin) || DESCENDING.includes(pin);
}
