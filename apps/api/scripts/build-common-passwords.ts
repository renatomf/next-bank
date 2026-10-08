// Builds the common passwords list (AUTH-07) from a downloaded copy of
// SecLists Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt (MIT).
// Usage: node scripts/build-common-passwords.ts <downloaded-file>
import { readFileSync, writeFileSync } from 'node:fs';
import { Cpf } from '../src/shared/domain/cpf.ts';
import { COMMON_PASSWORDS_FILE } from '../src/modules/identity/infrastructure/common-password-file.ts';

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Lists built from breaches may contain personal data, and this repository is public.
function looksPersonal(entry: string): boolean {
  if (EMAIL.test(entry)) return true;
  try {
    Cpf.parse(entry);
    return true;
  } catch {
    return false;
  }
}

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-common-passwords.ts <downloaded-file>');

const entries = new Set<string>();
for (const line of readFileSync(source, 'utf8').split(/\r?\n/)) {
  // Same rules as Password: length in code points, compared in lowercase.
  const length = Array.from(line).length;
  const entry = line.toLowerCase();
  if (length >= MIN_LENGTH && length <= MAX_LENGTH && !looksPersonal(entry)) entries.add(entry);
}

writeFileSync(COMMON_PASSWORDS_FILE, [...entries].sort().join('\n') + '\n');
process.stdout.write(`${String(entries.size)} entries written to ${COMMON_PASSWORDS_FILE}\n`);
