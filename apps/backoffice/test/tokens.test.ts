import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The backoffice wears the app's colors (v1.3.0 plan, task 3.5, E1): the
// tokens of tokens.dart are the source, and styles/tokens.css mirrors them.
// A color changed in one place and not the other fails here.
const dart = readFileSync(
  new URL('../../../packages/design_system/lib/src/tokens/tokens.dart', import.meta.url),
  'utf8',
);
const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

/** 0xAARRGGBB in Dart → rrggbbaa, as CSS writes it. */
const fromDart = (argb: string) => `${argb.slice(2)}${argb.slice(0, 2)}`.toLowerCase();

/** #rrggbb or #rrggbbaa → rrggbbaa. */
const fromCss = (hex: string) =>
  (hex.length === 7 ? `${hex.slice(1)}ff` : hex.slice(1)).toLowerCase();

const brand = Object.fromEntries(
  [...dart.matchAll(/static const Color (\w+) = Color\(0x([0-9A-Fa-f]{8})\)/g)].map(
    ([, name = '', argb = '']) => [`NbBrand.${name}`, fromDart(argb)],
  ),
);

/** The colors of one mode, field by field, resolving NbBrand references. */
function dartMode(mode: 'dark' | 'light'): Record<string, string> {
  const block = new RegExp(`static const NbColors ${mode} = NbColors\\(([^;]+)\\);`).exec(
    dart,
  )?.[1];
  if (!block) throw new Error(`NbColors.${mode} not found in tokens.dart`);
  return Object.fromEntries(
    [...block.matchAll(/(\w+): (?:Color\(0x([0-9A-Fa-f]{8})\)|(NbBrand\.\w+))/g)].map(
      ([, field = '', argb, reference = '']) => [
        field,
        argb ? fromDart(argb) : (brand[reference] ?? ''),
      ],
    ),
  );
}

/** camelCase field → --nb-kebab-case, as tokens.css names it. */
const cssName = (field: string) =>
  `--nb-${field.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`;

function cssToken(name: string): { light: string; dark: string } {
  const match = new RegExp(
    `${name}:\\s*light-dark\\((#[0-9a-fA-F]{6,8}),\\s*(#[0-9a-fA-F]{6,8})\\)`,
  ).exec(css);
  if (!match) throw new Error(`${name} is missing from tokens.css, or not a light-dark() pair`);
  return { light: fromCss(match[1] ?? ''), dark: fromCss(match[2] ?? '') };
}

describe('the tokens of the backoffice', () => {
  const light = dartMode('light');
  const dark = dartMode('dark');

  it('reads every color of both modes from tokens.dart', () => {
    expect(Object.keys(light)).toHaveLength(12);
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });

  it.each(Object.keys(dartMode('light')))('mirrors %s in both modes', (field) => {
    expect(cssToken(cssName(field))).toEqual({ light: light[field], dark: dark[field] });
  });
});
