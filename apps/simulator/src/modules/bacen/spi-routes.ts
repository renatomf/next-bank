import { createHash, randomUUID } from 'node:crypto';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { ErrorBodySchema } from '../../base/error-body.ts';
import type { Faults } from '../../base/faults.ts';

// The Bacen's end-to-end id: E, the payer's ISPB, the time and 11 characters.
const END_TO_END_ID = /^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$/;

const PaymentRequestSchema = z
  .strictObject({
    endToEndId: z.string().regex(END_TO_END_ID),
    amount: z.strictObject({
      amount: z.int().positive(),
      currency: z.literal('BRL'),
    }),
    payer: z.strictObject({
      ispb: z.string().regex(/^[0-9]{8}$/),
      name: z.string().min(1).max(80),
      documentMasked: z.string().min(1).max(20),
    }),
    payeeKey: z.string().min(1).max(77),
  })
  // The Bacen's end-to-end id starts with the payer's ISPB.
  .refine((body) => body.endToEndId.slice(1, 9) === body.payer.ispb, {
    message: 'the end-to-end id must start with the payer ISPB',
  });

type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

const PaymentParamsSchema = z.strictObject({ endToEndId: z.string().regex(END_TO_END_ID) });

const PaymentStatusSchema = z.strictObject({
  endToEndId: z.string(),
  status: z.enum(['PENDING', 'SETTLED', 'REJECTED']),
  reason: z.enum(['PAYEE_KEY_NOT_FOUND', 'PAYEE_BANK_REJECTED']).optional(),
  settledAt: z.iso.datetime().optional(),
});

interface PaymentRow {
  status: 'PENDING' | 'SETTLED' | 'REJECTED';
  reason: 'PAYEE_KEY_NOT_FOUND' | 'PAYEE_BANK_REJECTED' | null;
  settled_at: Date | null;
}

/**
 * The SPI (v1.2.0 plan, task 1): a payment is taken with 202 and answered
 * later by a webhook (see the dispatcher). The same end-to-end id is one
 * payment however often it comes (ADR 0007); its status can always be asked
 * (EXT-03). An injected error comes before the payment is taken, so it may
 * be sent again; an injected timeout comes after, so its status must be
 * asked instead (D5).
 */
export const spiRoutes: FastifyPluginAsyncZod<{ pool: pg.Pool; faults: Faults }> = (
  app,
  { pool, faults },
) => {
  app.post('/spi/payments', { schema: { body: PaymentRequestSchema } }, async (request, reply) => {
    const fault = faults.requestFault();
    if (fault === 'ERROR') return reply.status(503).send({ code: 'Unavailable' });

    const body = request.body;
    const taken = await take(pool, body, faults.profile.webhookDelayMs);
    if (taken === 'REUSED') return reply.status(409).send({ code: 'EndToEndIdReused' });

    if (fault === 'TIMEOUT') {
      // Taken, but the answer never comes: the connection is just dropped.
      reply.hijack();
      request.raw.socket.destroy();
      return reply;
    }
    return reply.status(202).send({ endToEndId: body.endToEndId, status: 'PENDING' });
  });

  app.get(
    '/spi/payments/:endToEndId',
    {
      schema: {
        params: PaymentParamsSchema,
        response: { 200: PaymentStatusSchema, 404: ErrorBodySchema },
      },
    },
    async (request, reply) => {
      const { endToEndId } = request.params;
      const { rows } = await pool.query<PaymentRow>(
        'SELECT status, reason, settled_at FROM simulator.payments WHERE end_to_end_id = $1',
        [endToEndId],
      );
      const row = rows[0];
      if (!row) return reply.status(404).send({ code: 'PaymentNotFound' });
      return {
        endToEndId,
        status: row.status,
        ...(row.reason ? { reason: row.reason } : {}),
        ...(row.settled_at ? { settledAt: row.settled_at.toISOString() } : {}),
      };
    },
  );
  return Promise.resolve();
};

/**
 * Records the payment and the webhook it is owed (due after the injected
 * delay), in one transaction; a
 * repeated request finds the first. Simultaneous requests with the same id
 * wait on the primary key, so one records and the others read it.
 */
async function take(
  pool: pg.Pool,
  body: PaymentRequest,
  webhookDelayMs: number,
): Promise<'TAKEN' | 'REUSED'> {
  const hash = requestHash(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO simulator.payments
         (end_to_end_id, request_hash, amount, currency, payer_ispb, payer_name,
          payer_document_masked, payee_key, payee_ispb, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               (SELECT bank_ispb FROM simulator.dict_keys WHERE key = $8), 'PENDING')
       ON CONFLICT (end_to_end_id) DO NOTHING`,
      [
        body.endToEndId,
        hash,
        body.amount.amount,
        body.amount.currency,
        body.payer.ispb,
        body.payer.name,
        body.payer.documentMasked,
        body.payeeKey,
      ],
    );
    if (inserted.rowCount === 1) {
      await client.query(
        `INSERT INTO simulator.webhook_deliveries (id, event_id, end_to_end_id, status, due_at)
         VALUES ($1, $2, $3, 'PENDING', now() + make_interval(secs => $4::numeric / 1000))`,
        [randomUUID(), randomUUID(), body.endToEndId, webhookDelayMs],
      );
      await client.query('COMMIT');
      return 'TAKEN';
    }
    const { rows } = await client.query<{ request_hash: string }>(
      'SELECT request_hash FROM simulator.payments WHERE end_to_end_id = $1',
      [body.endToEndId],
    );
    await client.query('COMMIT');
    return rows[0]?.request_hash === hash ? 'TAKEN' : 'REUSED';
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** The request in a fixed field order, so the same payment always hashes the same. */
function requestHash(body: PaymentRequest): string {
  const canonical = JSON.stringify([
    body.endToEndId,
    body.amount.amount,
    body.amount.currency,
    body.payer.ispb,
    body.payer.name,
    body.payer.documentMasked,
    body.payeeKey,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}
