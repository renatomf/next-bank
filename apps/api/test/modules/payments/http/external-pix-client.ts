import { createHmac, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { AURORA_KEY } from '../../../simulator.ts';
import { fictitiousCpf, uniqueEmail } from '../../identity/fixtures.ts';

const PIN = '2580';
let nextIp = 1;

const auth = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });

/** A customer and a Pix to another bank, over HTTP, for the SPI's answer to end. */
export function externalPixClient(app: FastifyInstance, ipPrefix: string) {
  return {
    auth,

    async newCustomer(): Promise<string> {
      const registered = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          name: 'Maria Teste',
          email: uniqueEmail(),
          cpf: fictitiousCpf(),
          password: 'violet staple orbit 42',
        },
        remoteAddress: `${ipPrefix}.${String(nextIp++)}`,
      });
      expect(registered.statusCode).toBe(201);
      const { accessToken } = registered.json<{ accessToken: string }>();
      const pin = await app.inject({
        method: 'POST',
        url: '/v1/me/pin',
        payload: { pin: PIN },
        headers: auth(accessToken),
      });
      expect(pin.statusCode).toBe(204);
      return accessToken;
    },

    /** Creates and authorizes a Pix to the made-up Banco Aurora; it waits for the SPI. */
    async sendToAurora(
      accessToken: string,
      amount = 8_000,
    ): Promise<{ id: string; endToEndId: string }> {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/pix/transfers',
        headers: { ...auth(accessToken), 'idempotency-key': randomUUID() },
        payload: { key: { type: 'EMAIL', value: AURORA_KEY }, amount: { amount, currency: 'BRL' } },
      });
      expect(created.statusCode).toBe(201);
      const { id } = created.json<{ id: string }>();
      const authorized = await app.inject({
        method: 'POST',
        url: `/v1/pix/transfers/${id}/authorize`,
        headers: { ...auth(accessToken), 'idempotency-key': randomUUID() },
        payload: { pin: PIN },
      });
      expect(authorized.statusCode).toBe(200);
      return { id, endToEndId: authorized.json<{ endToEndId: string }>().endToEndId };
    },

    async pix(accessToken: string, id: string) {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/pix/transfers/${id}`,
        headers: auth(accessToken),
      });
      return response.json<{ status: string; failureReason: string | null }>();
    },

    async balanceOf(accessToken: string): Promise<number> {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/me/account',
        headers: auth(accessToken),
      });
      return response.json<{ availableBalance: { amount: number } }>().availableBalance.amount;
    },
  };
}

/** A webhook as the SPI signs it (EXT-01): HMAC-SHA256 of "<seconds>.<body>". */
export function signedWebhook(
  secret: Uint8Array,
  event: Record<string, unknown>,
  seconds = Math.floor(Date.now() / 1000),
): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify(event);
  const mac = createHmac('sha256', secret)
    .update(`${String(seconds)}.${body}`)
    .digest('hex');
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-simulator-signature': `t=${String(seconds)},v1=${mac}`,
    },
  };
}
