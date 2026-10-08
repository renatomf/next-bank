import type { KeyLookupQuota } from '../application/ports.ts';

const LOOKUPS_PER_WINDOW = 30;
const WINDOW_MS = 60 * 60_000;
const DEFAULT_CAPACITY = 10_000;

interface Window {
  startedAt: number;
  used: number;
}

/**
 * Lookups per customer in process memory, in windows of one hour from the first
 * lookup (one instance in V1, like the login counters; a restart clears them).
 * Keys are user ids, never personal data; the oldest customers are dropped
 * beyond the capacity.
 */
export class InMemoryKeyLookupQuota implements KeyLookupQuota {
  readonly #windows = new Map<string, Window>();
  readonly #capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.#capacity = capacity;
  }

  tryTake(customerId: string, cost: number, now: Date): boolean {
    const window = this.#current(customerId, now);
    if (window.used + cost > LOOKUPS_PER_WINDOW) return false;
    window.used += cost;
    return true;
  }

  charge(customerId: string, cost: number, now: Date): void {
    this.#current(customerId, now).used += cost;
  }

  #current(customerId: string, now: Date): Window {
    const existing = this.#windows.get(customerId);
    if (existing !== undefined && now.getTime() - existing.startedAt < WINDOW_MS) return existing;

    const fresh = { startedAt: now.getTime(), used: 0 };
    // Re-inserting moves the key to the end: Map keeps insertion order.
    this.#windows.delete(customerId);
    this.#windows.set(customerId, fresh);
    while (this.#windows.size > this.#capacity) {
      const oldest = this.#windows.keys().next().value;
      if (oldest === undefined) break;
      this.#windows.delete(oldest);
    }
    return fresh;
  }
}
