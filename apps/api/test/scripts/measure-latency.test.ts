import { describe, expect, it } from 'vitest';
import { percentile } from '../../scripts/measure-latency.ts';

// The p95 of the performance budget (CLAUDE.md, Performance; week 8 plan,
// task 5), by nearest rank: always a latency that was actually measured.
describe('percentile', () => {
  const oneToHundred = Array.from({ length: 100 }, (_, index) => index + 1);

  it('takes the nearest rank', () => {
    expect(percentile(oneToHundred, 95)).toBe(95);
    expect(percentile(oneToHundred, 50)).toBe(50);
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
  });

  it('does not depend on the order measured, nor change it', () => {
    const measured = [40, 10, 30, 20];

    expect(percentile(measured, 50)).toBe(20);
    expect(measured).toEqual([40, 10, 30, 20]);
  });

  it('is the only value of a single measurement', () => {
    expect(percentile([123], 95)).toBe(123);
  });

  it('refuses no measurements at all', () => {
    expect(() => percentile([], 95)).toThrow(/no samples/);
  });
});
