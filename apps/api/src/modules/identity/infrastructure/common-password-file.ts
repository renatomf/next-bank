import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CommonPasswordList } from '../domain/password.ts';

/**
 * NCSC 100k most used passwords (SecLists, MIT), lowercased and reduced to the
 * entries the length rule would accept. Regenerate with
 * scripts/build-common-passwords.ts.
 */
export const COMMON_PASSWORDS_FILE = fileURLToPath(
  new URL('./common-passwords.txt', import.meta.url),
);

/** Loaded once at startup: about 9,000 entries in a Set. */
export function loadCommonPasswords(): CommonPasswordList {
  const entries = new Set(
    readFileSync(COMMON_PASSWORDS_FILE, 'utf8')
      .split('\n')
      .filter((entry) => entry.length > 0),
  );
  return { contains: (candidate) => entries.has(candidate) };
}
