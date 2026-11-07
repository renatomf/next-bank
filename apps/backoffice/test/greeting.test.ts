import { describe, expect, it } from 'vitest';
import { greetingOf } from '../features/home/greeting';

// The home's greeting, in Brasília time: the server runs in UTC (home plan,
// "Estado global"), and 00:00 UTC is still the evening before in Brasília.
describe('greetingOf', () => {
  it.each([
    ['2026-11-04T07:00:00Z', 'Boa noite'],
    ['2026-11-04T08:00:00-03:00', 'Bom dia'],
    ['2026-11-04T11:59:00-03:00', 'Bom dia'],
    ['2026-11-04T12:00:00-03:00', 'Boa tarde'],
    ['2026-11-04T17:59:00-03:00', 'Boa tarde'],
    ['2026-11-04T18:00:00-03:00', 'Boa noite'],
    ['2026-11-04T04:59:00-03:00', 'Boa noite'],
    ['2026-11-04T05:00:00-03:00', 'Bom dia'],
  ])('at %s says %s', (moment, salutation) => {
    expect(greetingOf(new Date(moment)).salutation).toBe(salutation);
  });

  it('names the day in Brasília, not in UTC', () => {
    // 01:30 UTC on Thursday is 22:30 on Wednesday in Brasília.
    expect(greetingOf(new Date('2026-11-05T01:30:00Z')).date).toBe('quarta-feira, 4 de novembro');
  });
});
