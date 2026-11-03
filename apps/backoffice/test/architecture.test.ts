import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Where each piece of the backoffice's UI lives (ADR 0020, after ADR 0014):
// components/ui is generic, components/nb holds the bank's concepts, and
// features/ the screens' own parts. The rules read the source, as the app's
// architecture_test.dart does.
const root = fileURLToPath(new URL('..', import.meta.url));

function sources(folder: string): string[] {
  const path = join(root, folder);
  let entries: string[];
  try {
    entries = readdirSync(path);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) return sources(relative(root, full));
    return /\.(ts|tsx)$/.test(entry) ? [relative(root, full).replaceAll('\\', '/')] : [];
  });
}

const read = (file: string) => readFileSync(join(root, file), 'utf8');
const importsOf = (file: string) =>
  [...read(file).matchAll(/from '([^']+)'/g)].map(([, target = '']) => target);

// A literal color, or a Tailwind class with one inside brackets.
const LITERAL_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border|ring|fill|stroke)-\[(?:#|rgb|hsl)/;

describe('the boundaries of the UI', () => {
  it('finds the folders it guards', () => {
    expect(sources('components/ui').length).toBeGreaterThan(0);
    expect(sources('components/nb').length).toBeGreaterThan(0);
    expect(sources('features').length).toBeGreaterThan(0);
  });

  it.each(sources('components/ui'))('%s knows nothing of the bank', (file) => {
    expect(importsOf(file).filter((target) => /components\/nb|features\//.test(target))).toEqual(
      [],
    );
  });

  it.each(sources('features'))('%s uses no other feature', (file) => {
    const feature = file.split('/')[1];
    const others = importsOf(file).filter(
      (target) => target.includes('features/') && !target.includes(`features/${String(feature)}`),
    );
    expect(others).toEqual([]);
  });

  it.each([...sources('app'), ...sources('features'), ...sources('components/nb')])(
    '%s takes its colors from the tokens',
    (file) => {
      expect(read(file)).not.toMatch(LITERAL_COLOR);
    },
  );

  // E5: the CSP has no unsafe-inline, so a style attribute would be dropped.
  it.each([...sources('app'), ...sources('features'), ...sources('components')])(
    '%s sets no inline style',
    (file) => {
      expect(read(file)).not.toMatch(/\bstyle=\{/);
    },
  );

  // A bare select opens the operating system's list, white and blue whatever
  // the theme: the screens use the ui Select, drawn with the tokens.
  it.each([...sources('app'), ...sources('features'), ...sources('components/nb')])(
    '%s uses the themed select',
    (file) => {
      expect(read(file)).not.toMatch(/<select[\s>]/);
    },
  );
});
