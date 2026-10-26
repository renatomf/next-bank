import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isValidWebhookSignature } from '../../../src/shared/infrastructure/webhook-signature.ts';

// The SPI's webhook signature (v1.2.0 plan, task 4; EXT-01): HMAC-SHA256 of
// "<timestamp>.<raw body>" with the shared secret, as "t=<seconds>,v1=<hex>",
// compared in constant time, accepted within 5 minutes of the server clock.
const secret = randomBytes(32);
const body = '{"eventId":"0f8e2c1a-5b7d-4e39-9a64-3c2d1b0a9f87","status":"SETTLED"}';
const NOW = new Date('2026-10-26T15:00:00.000Z');
const nowSeconds = NOW.getTime() / 1000;

function sign(timestamp: number, payload = body, key: Uint8Array = secret): string {
  const mac = createHmac('sha256', key)
    .update(`${String(timestamp)}.${payload}`)
    .digest('hex');
  return `t=${String(timestamp)},v1=${mac}`;
}

const check = (header: string | undefined, payload = body) =>
  isValidWebhookSignature({ header, body: payload, secret, now: NOW });

describe('isValidWebhookSignature', () => {
  it('accepts a body signed with the secret, now', () => {
    expect(check(sign(nowSeconds))).toBe(true);
  });

  it('accepts a signature up to 5 minutes old or ahead', () => {
    expect(check(sign(nowSeconds - 300))).toBe(true);
    expect(check(sign(nowSeconds + 300))).toBe(true);
  });

  it.each([
    ['no signature', undefined],
    ['an empty signature', ''],
    ['another secret', sign(nowSeconds, body, randomBytes(32))],
    ['a signature older than 5 minutes (replayed)', sign(nowSeconds - 301)],
    ['a signature more than 5 minutes ahead', sign(nowSeconds + 301)],
    ['a malformed header', 'v1=abc,t=1'],
    ['a short MAC', `t=${String(nowSeconds)},v1=abcd`],
    ['a MAC that is not hex', `t=${String(nowSeconds)},v1=${'z'.repeat(64)}`],
    ['a timestamp that is not a number', `t=soon,v1=${'0'.repeat(64)}`],
  ])('refuses %s', (_case, header) => {
    expect(check(header)).toBe(false);
  });

  it('refuses a body changed after signing', () => {
    expect(check(sign(nowSeconds), body.replace('SETTLED', 'REJECTED'))).toBe(false);
  });
});
