import { describe, expect, it } from 'vitest';
import { MAX_OUTBOX_ATTEMPTS, nextDelivery } from '../../../src/shared/application/outbox.ts';

// How a message that failed is tried again (v1.2.0 plan, task 2, O2;
// EXT-08): waits that double from 1 s, about 8.5 minutes in all, and after
// the last attempt the message is dead, for a person to decide.
const now = new Date('2026-10-22T12:00:00Z');
const after = (ms: number) => new Date(now.getTime() + ms);

describe('nextDelivery', () => {
  it.each([
    [1, 1_000],
    [2, 2_000],
    [3, 4_000],
    [5, 16_000],
    [9, 256_000],
  ])('after attempt %i, waits %i ms', (attempts, waitMs) => {
    expect(nextDelivery(attempts, now)).toEqual({ status: 'PENDING', availableAt: after(waitMs) });
  });

  it('gives up after the last attempt, ten in all', () => {
    expect(MAX_OUTBOX_ATTEMPTS).toBe(10);
    expect(nextDelivery(MAX_OUTBOX_ATTEMPTS, now)).toEqual({ status: 'DEAD' });
  });
});
