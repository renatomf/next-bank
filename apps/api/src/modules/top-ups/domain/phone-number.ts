import { InvalidPhoneNumber } from './errors.ts';

// Brazil's area codes (DDD) in use, by Anatel's numbering plan.
const AREA_CODES = new Set([
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28],
  ...[31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49],
  ...[51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69],
  ...[71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89],
  ...[91, 92, 93, 94, 95, 96, 97, 98, 99],
]);

// The made-up range: an area code, then 9 0000 and any four digits.
const MADE_UP = /^(\d{2})90000(\d{4})$/;

/**
 * A mobile number a top-up goes to. Only the made-up range (DD) 90000-XXXX
 * is taken, so no one recharges a real person's line, not even by mistake
 * (TOP-01, DEMO-01, decision R1).
 */
export class PhoneNumber {
  /** The eleven digits, kept only encrypted (TOP-01). */
  readonly digits: string;

  private constructor(digits: string) {
    this.digits = digits;
  }

  /** Reads a number as people type it: spaces, brackets and dashes are dropped. */
  static parse(raw: string): PhoneNumber {
    const digits = raw.replace(/[\s()-]/g, '');
    const match = MADE_UP.exec(digits);
    if (!match || !AREA_CODES.has(Number(match[1]))) throw new InvalidPhoneNumber();
    return new PhoneNumber(digits);
  }

  /** The area code and the last four digits: what every answer and screen shows. */
  get masked(): string {
    return `(${this.digits.slice(0, 2)}) *****-${this.digits.slice(-4)}`;
  }
}
