import { describe, expect, it } from 'vitest';
import { deadlineOf } from '../components/nb/deadline';

// How close a request is to expiring (home plan, H3): it expires 24 hours
// after it was opened (K4), and the tone follows the time left, always with
// the words, never the color alone.
const now = new Date('2026-11-04T12:00:00Z');
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

describe('deadlineOf', () => {
  it.each([
    [24 * 60, 'calm', 'vence em 24 h'],
    [12 * 60 + 1, 'calm', 'vence em 12 h'],
    [12 * 60, 'soon', 'vence em 12 h'],
    [4 * 60 + 1, 'soon', 'vence em 4 h'],
    [4 * 60, 'urgent', 'vence em 4 h'],
    [90, 'urgent', 'vence em 1 h'],
    [59, 'urgent', 'vence em 59 min'],
    [1, 'urgent', 'vence em 1 min'],
    [0, 'expired', 'vencido'],
    [-30, 'expired', 'vencido'],
  ])('with %i minutes left reads %s, "%s"', (minutes, tone, text) => {
    expect(deadlineOf(inMinutes(minutes), now)).toEqual({ tone, text });
  });

  it('counts a part of a minute left as a minute', () => {
    const expiresAt = new Date(now.getTime() + 20_000).toISOString();

    expect(deadlineOf(expiresAt, now)).toEqual({ tone: 'urgent', text: 'vence em 1 min' });
  });
});
