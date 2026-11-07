import { describe, expect, it } from 'vitest';
import { countOf, oldestFirst, waitingSummary } from '../features/home/queue';

// The home reads one page of each list (home plan, H2): the oldest first,
// and "20+" when the page came full, since more wait on the next one.
describe('oldestFirst', () => {
  it('puts the longest waiting first', () => {
    const items = [
      { id: 'c', at: '2026-11-04T12:00:00Z' },
      { id: 'a', at: '2026-11-02T09:00:00Z' },
      { id: 'b', at: '2026-11-03T18:30:00Z' },
    ];

    expect(oldestFirst(items, (item) => item.at).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves the page it was given as it was', () => {
    const items = [
      { id: 'b', at: '2026-11-04T12:00:00Z' },
      { id: 'a', at: '2026-11-02T09:00:00Z' },
    ];

    oldestFirst(items, (item) => item.at);

    expect(items.map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('countOf', () => {
  it('counts a page that is all there is', () => {
    expect(countOf({ items: [1, 2, 3], nextCursor: null })).toBe('3');
  });

  it('says "+" when another page follows', () => {
    expect(countOf({ items: Array.from({ length: 20 }, () => 1), nextCursor: 'next' })).toBe('20+');
  });
});

describe('waitingSummary', () => {
  it.each([
    ['0', 'Nenhum pedido espera sua decisão'],
    ['1', '1 pedido espera sua decisão'],
    ['3', '3 pedidos esperam sua decisão'],
    ['20+', '20+ pedidos esperam sua decisão'],
  ])('with %s reads "%s"', (count, text) => {
    expect(waitingSummary(count)).toBe(text);
  });
});
