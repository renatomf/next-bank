import { randomInt, randomUUID } from 'node:crypto';

/**
 * A random CPF with valid check digits, generated at test time and only stored
 * in the throwaway test database. Never committed as data.
 */
export function fictitiousCpf(): string {
  const base = Array.from({ length: 9 }, () => randomInt(10));
  const first = checkDigit(base);
  const digits = [...base, first, checkDigit([...base, first])].join('');
  // Repeated digits are refused by Cpf: try again in that (1 in 10^8) case.
  return /^(\d)\1{10}$/.test(digits) ? fictitiousCpf() : digits;
}

function checkDigit(numbers: number[]): number {
  const sum = numbers.reduce((total, n, index) => total + n * (numbers.length + 1 - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function uniqueEmail(): string {
  return `user-${randomUUID()}@example.test`;
}
