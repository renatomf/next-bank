import { Money } from '../../../shared/domain/money.ts';
import { TopUpLimitExceeded } from './errors.ts';

/** R$ 200,00 of top-ups per customer per day (D6). */
export const TOP_UP_DAILY_LIMIT = Money.of(20_000n);

// The day is the server's, in São Paulo: never the device's (as PIX-10).
const SAO_PAULO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// São Paulo has kept UTC-3 all year since daylight saving ended in 2019.
const SAO_PAULO_OFFSET = '-03:00';

/** Midnight of [now]'s day in São Paulo, the start of the daily limit. */
export function startOfDayInSaoPaulo(now: Date): Date {
  return new Date(`${SAO_PAULO_DATE.format(now)}T00:00:00.000${SAO_PAULO_OFFSET}`);
}

/** Refuses [amount] when, with what was topped up today, it passes the limit. */
export function assertWithinDailyLimit(spentToday: Money, amount: Money): void {
  const remaining = TOP_UP_DAILY_LIMIT.minus(spentToday);
  if (remaining.isLessThan(amount)) {
    const left = remaining.isNegative() ? Money.zero() : remaining;
    throw new TopUpLimitExceeded(TOP_UP_DAILY_LIMIT, left);
  }
}
