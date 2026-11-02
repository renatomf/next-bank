import { cn } from '@/lib/utils';

/**
 * The wordmark (brief, section 6): "next" in Sora 700, tracking -4%, and a
 * mint dot on the baseline, close to the "t", a fifth of the type size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn('font-display font-bold tracking-[-0.04em] text-foreground', className)}
      aria-label="next bank"
    >
      next
      <span
        aria-hidden="true"
        className="ml-[0.06em] inline-block size-[0.2em] rounded-full bg-mint align-baseline"
      />
    </span>
  );
}
