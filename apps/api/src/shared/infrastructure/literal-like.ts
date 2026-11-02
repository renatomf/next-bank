/**
 * Text taken literally inside a LIKE pattern with ESCAPE '\': a % or _ typed
 * by someone is a letter, never a wildcard (READ-04).
 */
export function literalLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
