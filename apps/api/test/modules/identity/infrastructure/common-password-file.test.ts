import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Cpf } from '../../../../src/modules/identity/domain/cpf.ts';
import {
  COMMON_PASSWORDS_FILE,
  loadCommonPasswords,
} from '../../../../src/modules/identity/infrastructure/common-password-file.ts';

// Common passwords (AUTH-07): the NCSC 100k list from SecLists (MIT), filtered by
// scripts/build-common-passwords.ts. The repository is public, so the file must
// not carry anything that looks like personal data.
const entries = readFileSync(COMMON_PASSWORDS_FILE, 'utf8').split('\n').filter(Boolean);

function codePoints(entry: string): number {
  return Array.from(entry).length;
}

function isValidCpf(entry: string): boolean {
  try {
    Cpf.parse(entry);
    return true;
  } catch {
    return false;
  }
}

describe('common passwords file', () => {
  it('has thousands of entries', () => {
    expect(entries.length).toBeGreaterThan(5_000);
  });

  it('keeps only what the length rule would let through (10 to 128 characters)', () => {
    expect(entries.filter((entry) => codePoints(entry) < 10 || codePoints(entry) > 128)).toEqual(
      [],
    );
  });

  it('is lowercase, matching how Password checks it', () => {
    expect(entries.filter((entry) => entry !== entry.toLowerCase())).toEqual([]);
  });

  it('has no valid CPF and no e-mail address', () => {
    const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

    expect(entries.filter((entry) => email.test(entry) || isValidCpf(entry))).toEqual([]);
  });
});

describe('loadCommonPasswords', () => {
  const list = loadCommonPasswords();

  it('finds common passwords', () => {
    expect(list.contains('1234567890')).toBe(true);
    expect(list.contains('qwertyuiop')).toBe(true);
  });

  it('does not flag an uncommon password', () => {
    expect(list.contains('violet staple orbit 42')).toBe(false);
  });
});
