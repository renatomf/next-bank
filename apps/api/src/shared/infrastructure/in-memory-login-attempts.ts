import { createHash } from 'node:crypto';
import type { LoginAttemptsStore } from '../application/ports.ts';
import type { LoginAttemptsState } from '../domain/login-attempts.ts';

const DEFAULT_CAPACITY = 10_000;

/**
 * Login attempt counters in process memory (plan D3: one instance in V1; a restart
 * clears them). Keys are SHA-256 of the e-mail, so no address sits in memory, and
 * the oldest accounts are dropped beyond the capacity. Accepted risk: a flood of
 * random e-mails can push a real account's counter out; the per-IP limit narrows it.
 */
export class InMemoryLoginAttempts implements LoginAttemptsStore {
  readonly #entries = new Map<string, LoginAttemptsState>();
  readonly #capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.#capacity = capacity;
  }

  get(email: string): LoginAttemptsState | undefined {
    const state = this.#entries.get(keyOf(email));
    return state ? copy(state) : undefined;
  }

  set(email: string, state: LoginAttemptsState): void {
    const key = keyOf(email);
    // Re-inserting moves the key to the end: Map keeps insertion order.
    this.#entries.delete(key);
    this.#entries.set(key, copy(state));
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  delete(email: string): void {
    this.#entries.delete(keyOf(email));
  }

  /** For tests: the stored keys, never the e-mails. */
  keys(): string[] {
    return [...this.#entries.keys()];
  }
}

function keyOf(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

function copy(state: LoginAttemptsState): LoginAttemptsState {
  return { ...state, recentFailures: [...state.recentFailures] };
}
