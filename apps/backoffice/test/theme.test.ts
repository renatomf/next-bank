import { describe, expect, it } from 'vitest';
import { THEME_COOKIE, themeCookie, themeOf } from '../lib/theme';

// Light or dark (v1.3.0 plan, task 3.5, E2): the system's until the member
// picks one, as in the app (D9). The choice lives in a cookie the server
// reads, so the page arrives in the right theme with no script.
describe('themeOf', () => {
  it.each(['light', 'dark', 'system'] as const)('takes %s as it was chosen', (choice) => {
    expect(themeOf(choice)).toBe(choice);
  });

  it.each([undefined, '', 'blue', 'DARK', 'dark; path=/'])('follows the system for %j', (value) => {
    expect(themeOf(value)).toBe('system');
  });
});

describe('themeCookie', () => {
  it('keeps the choice for a year, readable only by the server', () => {
    expect(themeCookie('dark')).toEqual({
      name: THEME_COOKIE,
      value: 'dark',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
  });
});
