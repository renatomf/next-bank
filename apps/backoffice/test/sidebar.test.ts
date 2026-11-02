import { describe, expect, it } from 'vitest';
import { SIDEBAR_COOKIE, sidebarCollapsedOf, sidebarCookie } from '../lib/sidebar';

// The sidebar stays as the member left it (task 3.5, E7): the server reads
// the cookie and renders it open or collapsed, so it never jumps on load.
describe('sidebarCollapsedOf', () => {
  it('collapses only when the cookie says so', () => {
    expect(sidebarCollapsedOf('collapsed')).toBe(true);
  });

  it.each([undefined, '', 'open', 'true', 'COLLAPSED'])('stays open for %j', (value) => {
    expect(sidebarCollapsedOf(value)).toBe(false);
  });
});

describe('sidebarCookie', () => {
  // Written by the browser on a click: a screen preference, nothing secret.
  it('is the cookie the browser writes, for a year, never sent by another site', () => {
    expect(sidebarCookie(true)).toBe(
      `${SIDEBAR_COOKIE}=collapsed; path=/; max-age=31536000; samesite=strict; secure`,
    );
    expect(sidebarCookie(false)).toBe(
      `${SIDEBAR_COOKIE}=open; path=/; max-age=31536000; samesite=strict; secure`,
    );
  });
});
