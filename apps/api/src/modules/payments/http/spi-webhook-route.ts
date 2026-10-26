import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Clock } from '../../../shared/application/ports.ts';
import { PROBLEM_CONTENT_TYPE, problem } from '../../../shared/http/problem.ts';
import {
  isValidWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from '../../../shared/infrastructure/webhook-signature.ts';
import type { ApplySpiOutcome } from '../application/apply-spi-outcome.ts';

// The Bacen's end-to-end id: E, the ISPB, the minute and 11 characters.
const END_TO_END_ID = /^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$/;

// What the SPI sends (v1.2.0 plan, task 1): the outcome of one payment.
const SpiEventSchema = z.strictObject({
  eventId: z.uuid(),
  version: z.literal(1),
  endToEndId: z.string().regex(END_TO_END_ID),
  status: z.enum(['SETTLED', 'REJECTED']),
  reason: z.enum(['PAYEE_KEY_NOT_FOUND', 'PAYEE_BANK_REJECTED']).optional(),
  occurredAt: z.iso.datetime(),
});

class BodyNotJson extends Error {
  readonly statusCode = 400;

  constructor() {
    // Never the body itself: an error message reaches the log.
    super('Webhook body is not JSON');
  }
}

/**
 * The SPI's webhook (v1.2.0 plan, task 4). Public to the bearer check: the
 * signature over the raw body is the authentication (EXT-01), checked before
 * the body is even parsed. Every well-signed event is answered 200, applied
 * or not, so the SPI stops sending it; the inbox keeps a repeat from
 * changing anything (EXT-02). Not part of the app's contract.
 */
export const spiWebhookRoutes: FastifyPluginAsyncZod<{
  applySpiOutcome: ApplySpiOutcome;
  webhookSecret: Uint8Array;
  clock: Clock;
}> = (app, { applySpiOutcome, webhookSecret, clock }) => {
  // The signature covers the bytes as sent: the body stays raw until it is checked.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body);
  });

  app.addHook('preValidation', async (request, reply) => {
    const raw = typeof request.body === 'string' ? request.body : '';
    const signed = isValidWebhookSignature({
      header: request.headers[WEBHOOK_SIGNATURE_HEADER] as string | undefined,
      body: raw,
      secret: webhookSecret,
      now: clock.now(),
    });
    if (!signed) {
      return reply.status(401).type(PROBLEM_CONTENT_TYPE).send(problem(401, 'Unauthenticated'));
    }
    try {
      request.body = JSON.parse(raw) as unknown;
    } catch {
      throw new BodyNotJson();
    }
  });

  app.post(
    '/v1/spi/webhooks',
    {
      config: { public: true },
      schema: { hide: true, body: SpiEventSchema },
    },
    async (request, reply) => {
      const event = request.body;
      await applySpiOutcome.execute({
        eventId: event.eventId,
        endToEndId: event.endToEndId,
        status: event.status,
      });
      return reply.status(200).send();
    },
  );
  return Promise.resolve();
};
