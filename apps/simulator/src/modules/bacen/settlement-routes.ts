import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';

// A calendar day; checked to exist below (no 30 February).
const DateParamsSchema = z.strictObject({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((date) => {
      const day = new Date(`${date}T00:00:00Z`);
      return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(date);
    }),
});

const SettlementSchema = z.strictObject({
  date: z.string(),
  payments: z.array(
    z.strictObject({
      endToEndId: z.string(),
      amount: z.strictObject({ amount: z.int(), currency: z.literal('BRL') }),
      payerIspb: z.string(),
      payeeIspb: z.string(),
      settledAt: z.iso.datetime(),
    }),
  ),
});

interface SettledRow {
  end_to_end_id: string;
  /** bigint arrives as a string. */
  amount: string;
  payer_ispb: string;
  payee_ispb: string;
  settled_at: Date;
}

/**
 * The day's settlement file (v1.2.0 plan, task 1): the payments the SPI
 * settled in a day of São Paulo (UTC−3, no daylight saving since 2019), which
 * the API's reconciliation reads (task 6).
 */
export const settlementRoutes: FastifyPluginAsyncZod<{ pool: pg.Pool }> = (app, { pool }) => {
  app.get(
    '/settlements/:date',
    { schema: { params: DateParamsSchema, response: { 200: SettlementSchema } } },
    async (request) => {
      const { date } = request.params;
      const start = new Date(`${date}T00:00:00-03:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      // Served by payments_settled_at_idx.
      const { rows } = await pool.query<SettledRow>(
        `SELECT end_to_end_id, amount::text AS amount, payer_ispb, payee_ispb, settled_at
         FROM simulator.payments
         WHERE status = 'SETTLED' AND settled_at >= $1 AND settled_at < $2
         ORDER BY settled_at, end_to_end_id`,
        [start, end],
      );
      return {
        date,
        payments: rows.map((row) => ({
          endToEndId: row.end_to_end_id,
          amount: { amount: Number(row.amount), currency: 'BRL' as const },
          payerIspb: row.payer_ispb,
          payeeIspb: row.payee_ispb,
          settledAt: row.settled_at.toISOString(),
        })),
      };
    },
  );
  return Promise.resolve();
};
