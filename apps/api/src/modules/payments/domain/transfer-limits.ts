import { Money } from '../../../shared/domain/money.ts';
import { LimitExceeded } from './errors.ts';

/** The limit of the daytime, when a scheduled Pix always runs (v1.2.0 plan, S3). */
export const DAYTIME_LIMIT = Money.of(500_000n);
const NIGHT_LIMIT = Money.of(100_000n);
const DAY_STARTS_AT = 6;
const NIGHT_STARTS_AT = 20;

// The hour is always the server's, in São Paulo: never the device's (PIX-10).
const SAO_PAULO_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** From 6h to 20h in São Paulo. */
export function isDaytime(now: Date): boolean {
  const hour = Number(SAO_PAULO_HOUR.format(now));
  return hour >= DAY_STARTS_AT && hour < NIGHT_STARTS_AT;
}

/** R$ 5.000,00 from 6h to 20h, R$ 1.000,00 from 20h to 6h (domain-model.md 7). */
export function transferLimitAt(now: Date): Money {
  return isDaytime(now) ? DAYTIME_LIMIT : NIGHT_LIMIT;
}

export function assertWithinLimit(amount: Money, now: Date): void {
  const limit = transferLimitAt(now);
  if (limit.isLessThan(amount)) throw new LimitExceeded(limit);
}
