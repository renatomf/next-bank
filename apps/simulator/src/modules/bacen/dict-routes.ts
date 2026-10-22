import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { ErrorBodySchema } from '../../base/error-body.ts';

const KeyParamsSchema = z.strictObject({ key: z.string().min(1).max(77) });

const DictKeySchema = z.strictObject({
  key: z.string(),
  keyType: z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']),
  bank: z.strictObject({ ispb: z.string(), name: z.string() }),
  owner: z.strictObject({ name: z.string(), documentMasked: z.string() }),
});

interface DictKeyRow {
  key: string;
  key_type: 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';
  bank_ispb: string;
  bank_name: string;
  owner_name: string;
  owner_document_masked: string;
}

/** The DICT: who holds a key at another (made-up) bank, the document masked. */
export const dictRoutes: FastifyPluginAsyncZod<{ pool: pg.Pool }> = (app, { pool }) => {
  app.get(
    '/dict/keys/:key',
    { schema: { params: KeyParamsSchema, response: { 200: DictKeySchema, 404: ErrorBodySchema } } },
    async (request, reply) => {
      const { rows } = await pool.query<DictKeyRow>(
        `SELECT k.key, k.key_type, b.ispb AS bank_ispb, b.name AS bank_name,
                k.owner_name, k.owner_document_masked
         FROM simulator.dict_keys k JOIN simulator.banks b ON b.ispb = k.bank_ispb
         WHERE k.key = $1`,
        [request.params.key],
      );
      const row = rows[0];
      if (!row) return reply.status(404).send({ code: 'KeyNotFound' });
      return {
        key: row.key,
        keyType: row.key_type,
        bank: { ispb: row.bank_ispb, name: row.bank_name },
        owner: { name: row.owner_name, documentMasked: row.owner_document_masked },
      };
    },
  );
  return Promise.resolve();
};
