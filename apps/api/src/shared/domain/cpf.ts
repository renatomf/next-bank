import { DomainError } from './domain-error.ts';

// Either only digits or the usual 000.000.000-00 punctuation.
const ACCEPTED_FORMAT = /^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/;
const REPEATED_DIGITS = /^(\d)\1{10}$/;

export class InvalidCpf extends DomainError {
  readonly code = 'InvalidCpf';

  constructor() {
    super('CPF is invalid');
  }
}

/**
 * Brazilian individual taxpayer number, shared by Identity (the customer) and
 * Payments (the CPF Pix key). Personal sensitive data: printed only masked. */
export class Cpf {
  readonly digits: string;

  private constructor(digits: string) {
    this.digits = digits;
  }

  static parse(raw: string): Cpf {
    const input = raw.trim();
    if (!ACCEPTED_FORMAT.test(input)) throw new InvalidCpf();

    const digits = input.replace(/\D/g, '');
    // Repeated digits pass the check digit math but are not issued.
    if (REPEATED_DIGITS.test(digits) || !hasValidCheckDigits(digits)) throw new InvalidCpf();
    return new Cpf(digits);
  }

  /** Display form: only the middle six digits, as used on receipts. */
  get masked(): string {
    return `***.${this.digits.slice(3, 6)}.${this.digits.slice(6, 9)}-**`;
  }

  toString(): string {
    return this.masked;
  }

  toJSON(): string {
    return this.masked;
  }
}

function hasValidCheckDigits(digits: string): boolean {
  const numbers = Array.from(digits, Number);
  return (
    checkDigit(numbers.slice(0, 9)) === numbers[9] &&
    checkDigit(numbers.slice(0, 10)) === numbers[10]
  );
}

// Weighted sum from (length + 1) down to 2, modulo 11; remainders below 2 give 0.
function checkDigit(numbers: number[]): number {
  const sum = numbers.reduce((total, n, index) => total + n * (numbers.length + 1 - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
