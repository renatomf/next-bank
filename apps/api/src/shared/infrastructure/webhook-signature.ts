import { createHmac, timingSafeEqual } from 'node:crypto';

/** The header a partner's webhook carries its signature in. */
export const WEBHOOK_SIGNATURE_HEADER = 'x-simulator-signature';

/** How far a signature's time may be from the server's (EXT-01). */
const TOLERANCE_SECONDS = 300;

const SIGNATURE = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/;

/**
 * Whether a webhook was signed by the partner (v1.2.0 plan, task 4; EXT-01):
 * HMAC-SHA256 of "<timestamp>.<raw body>" with the shared secret, compared
 * in constant time, and a timestamp within 5 minutes of the server clock, so
 * a webhook captured once cannot be replayed later.
 */
export function isValidWebhookSignature(input: {
  header: string | undefined;
  body: string;
  secret: Uint8Array;
  now: Date;
}): boolean {
  const match = SIGNATURE.exec(input.header ?? '');
  const timestamp = match?.[1];
  const mac = match?.[2];
  if (timestamp === undefined || mac === undefined) return false;
  if (Math.abs(input.now.getTime() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', input.secret).update(`${timestamp}.${input.body}`).digest();
  return timingSafeEqual(expected, Buffer.from(mac, 'hex'));
}
