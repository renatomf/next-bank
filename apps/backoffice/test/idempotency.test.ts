import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { idempotencyKeyOf, newIdempotencyKey } from '../lib/idempotency';

// The key of a staff command is drawn when the form is rendered and travels
// with it (v1.3.0 plan, task 4, K6): a double click or a second tab of the
// same form sends the same key, and the API acts once.
describe('newIdempotencyKey', () => {
  it('draws a new UUID for each form', () => {
    const first = newIdempotencyKey();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(first);
  });
});

describe('idempotencyKeyOf', () => {
  it('reads the key the form carried', () => {
    // Drawn here: a key written in the code looks like a secret to gitleaks.
    const key = randomUUID();
    const form = new FormData();
    form.set('idempotencyKey', key);

    expect(idempotencyKeyOf(form)).toBe(key);
  });

  it.each([null, '', 'not-a-uuid'])('refuses %j: a form without its key acts never', (value) => {
    const form = new FormData();
    if (value !== null) form.set('idempotencyKey', value);

    expect(() => idempotencyKeyOf(form)).toThrow(/idempotency key/);
  });
});
