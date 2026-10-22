import { createHmac } from 'node:crypto';

/** The header that carries a webhook's signature. */
export const SIGNATURE_HEADER = 'x-simulator-signature';

/**
 * The signature of a webhook (EXT-01): HMAC-SHA256 over the timestamp and
 * the body, as `t=<seconds>,v1=<hex>`. Signing the timestamp lets the
 * participant refuse an old webhook replayed later.
 */
export function signatureHeader(
  secret: Uint8Array,
  body: string,
  timestampSeconds: number,
): string {
  const timestamp = String(timestampSeconds);
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}
