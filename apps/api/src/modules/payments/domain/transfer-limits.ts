import { Money } from '../../../shared/domain/money.ts';
import { LimitExceeded } from './errors.ts';

const DAY_LIMIT = Money.of(500_000n);
const NIGHT_LIMIT = Money.of(100_000n);
const DAY_STARTS_AT = 6;
const NIGHT_STARTS_AT = 20;

// The hour is always the server's, in São Paulo: never the device's (PIX-10).
const SAO_PAULO_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** R$ 5.000,00 from 6h to 20h, R$ 1.000,00 from 20h to 6h (domain-model.md 7). */
export function transferLimitAt(now: Date): Money {
  const hour = Number(SAO_PAULO_HOUR.format(now));
  return hour >= DAY_STARTS_AT && hour < NIGHT_STARTS_AT ? DAY_LIMIT : NIGHT_LIMIT;
}

export function assertWithinLimit(amount: Money, now: Date): void {
  const limit = transferLimitAt(now);
  if (limit.isLessThan(amount)) throw new LimitExceeded(limit);
}
