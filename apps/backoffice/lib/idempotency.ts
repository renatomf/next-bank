import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A key for one form, drawn when the server renders it (v1.3.0 plan, task 4, K6). */
export function newIdempotencyKey(): string {
  return randomUUID();
}

/**
 * The key the form carried back. A form without one never acts: sending a
 * fresh key here would turn a double click into two commands.
 */
export function idempotencyKeyOf(form: FormData): string {
  const key = form.get('idempotencyKey');
  if (typeof key !== 'string' || !UUID.test(key)) {
    throw new Error('The form came without its idempotency key');
  }
  return key;
}
