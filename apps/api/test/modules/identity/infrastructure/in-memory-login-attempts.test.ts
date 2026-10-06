import { describe, expect, it } from 'vitest';
import { LoginAttempts } from '../../../../src/modules/identity/domain/login-attempts.ts';
import { InMemoryLoginAttempts } from '../../../../src/modules/identity/infrastructure/in-memory-login-attempts.ts';

// Login attempt counters in memory (plan D3: one instance in V1).
const NOW = new Date('2026-10-06T12:00:00.000Z');

function oneFailure() {
  const attempts = LoginAttempts.none();
  attempts.recordFailure(NOW);
  return attempts.state;
}

describe('InMemoryLoginAttempts', () => {
  it('stores, reads and forgets the counters of an account', () => {
    const store = new InMemoryLoginAttempts();

    store.set('maria@example.test', oneFailure());
    expect(store.get('maria@example.test')).toEqual(oneFailure());

    store.delete('maria@example.test');
    expect(store.get('maria@example.test')).toBeUndefined();
  });

  it('keys counters by a hash, so no e-mail address sits in memory', () => {
    const store = new InMemoryLoginAttempts();

    store.set('maria@example.test', oneFailure());

    expect(store.keys().some((key) => key.includes('maria'))).toBe(false);
    expect(store.keys()[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps at most the configured number of accounts, dropping the oldest first', () => {
    const store = new InMemoryLoginAttempts(3);

    for (const name of ['a', 'b', 'c', 'd']) store.set(`${name}@example.test`, oneFailure());

    expect(store.keys()).toHaveLength(3);
    expect(store.get('a@example.test')).toBeUndefined();
    expect(store.get('d@example.test')).toBeDefined();
  });

  it('holds 10,000 accounts by default', () => {
    const store = new InMemoryLoginAttempts();

    for (let i = 0; i <= 10_000; i++) store.set(`user-${String(i)}@example.test`, oneFailure());

    expect(store.keys()).toHaveLength(10_000);
  });

  it('keeps its own copy of the state', () => {
    const store = new InMemoryLoginAttempts();
    const state = oneFailure();
    store.set('maria@example.test', state);

    state.recentFailures.push(NOW);

    expect(store.get('maria@example.test')?.recentFailures).toHaveLength(1);
  });
});
