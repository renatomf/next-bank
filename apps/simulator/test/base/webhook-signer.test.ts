import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signatureHeader } from '../../src/base/webhook-signer.ts';

// The SPI's webhooks are signed (EXT-01): HMAC-SHA256 of the timestamp and
// the body, so neither can be changed nor the webhook replayed later
// without the participant noticing (its check is task 4's).
const secret = Buffer.from('a'.repeat(32));
const body = '{"eventId":"e-1","status":"SETTLED"}';
const timestamp = 1_790_000_000;

describe('signatureHeader', () => {
  it('signs the timestamp and the body with the secret', () => {
    const expected = createHmac('sha256', secret).update(`${String(timestamp)}.${body}`).digest('hex');

    expect(signatureHeader(secret, body, timestamp)).toBe(`t=${String(timestamp)},v1=${expected}`);
  });

  it('changes with the body, the timestamp or the secret', () => {
    const base = signatureHeader(secret, body, timestamp);

    expect(signatureHeader(secret, `${body} `, timestamp)).not.toBe(base);
    expect(signatureHeader(secret, body, timestamp + 1)).not.toBe(base);
    expect(signatureHeader(Buffer.from('b'.repeat(32)), body, timestamp)).not.toBe(base);
  });
});
