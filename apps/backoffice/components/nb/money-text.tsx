import { formatMoney, type MoneyBody } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * An amount, from integer cents (ADR 0006). With a [direction], it carries
 * the sign and money coming in takes the success color; the sign is in the
 * text, so the meaning never depends on color alone (brief, section 8).
 */
export function MoneyText({
  money,
  direction,
  className,
}: {
  money: MoneyBody;
  direction?: 'IN' | 'OUT';
  className?: string;
}) {
  const sign = direction === 'IN' ? '+ ' : direction === 'OUT' ? '- ' : '';
  return (
    <span
      className={cn('font-display tabular-nums', direction === 'IN' && 'text-success', className)}
    >
      {sign}
      {formatMoney(money)}
    </span>
  );
}
