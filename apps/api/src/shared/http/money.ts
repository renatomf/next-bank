import { z } from 'zod';
import type { Money } from '../domain/money.ts';

/** Money in JSON: an integer of cents and its currency (ADR 0006, D1). */
export const MoneySchema = z
  .strictObject({
    amount: z.int().describe('Integer amount of cents, e.g. 35000 for R$ 350,00'),
    currency: z.literal('BRL'),
  })
  .meta({ id: 'Money' });

export function moneyBody(money: Money): z.infer<typeof MoneySchema> {
  return { amount: money.toJsonAmount(), currency: money.currency };
}
