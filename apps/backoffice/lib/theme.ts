export const THEME_COOKIE = 'nb_theme';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/**
 * The member's theme, from the cookie (v1.3.0 plan, task 3.5, E2): the
 * system's until one is picked, as in the app (D9). Anything else follows
 * the system, so a tampered cookie changes nothing but the colors.
 */
export function themeOf(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? 'system';
}

/** Kept for a year and read only by the server, which renders the page in it. */
export function themeCookie(theme: Theme) {
  return {
    name: THEME_COOKIE,
    value: theme,
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  };
}

/** What the toggle may record (task 3.5, E10): light or dark; anything else, nothing. */
export function chosenTheme(value: unknown): 'light' | 'dark' | null {
  return value === 'light' || value === 'dark' ? value : null;
}
