export const SIDEBAR_COOKIE = 'nb_sidebar';

/** Collapsed only when the member left it so; open by default (task 3.5, E7). */
export function sidebarCollapsedOf(value: string | undefined): boolean {
  return value === 'collapsed';
}

/**
 * The cookie the browser writes on a click: a screen preference, nothing
 * secret, so the browser may set it; the server reads it to render the
 * sidebar as the member left it.
 */
export function sidebarCookie(collapsed: boolean): string {
  return `${SIDEBAR_COOKIE}=${collapsed ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=strict; secure`;
}
