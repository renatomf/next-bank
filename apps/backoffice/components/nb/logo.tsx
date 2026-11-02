import { cn } from '@/lib/utils';

/**
 * The wordmark (brief, section 6): "next" in Sora 700, tracking -4%, and a
 * mint dot on the baseline, close to the "t", a fifth of the type size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="next bank"
      className={cn('font-display font-bold tracking-[-0.04em] text-foreground', className)}
    >
      next
      <span
        aria-hidden="true"
        className="ml-[0.06em] inline-block size-[0.2em] rounded-full bg-mint align-baseline"
      />
    </span>
  );
}

/**
 * The app's launcher icon (apps/mobile, ic_launcher): a white "n" and the
 * mint dot on a dark rounded tile, dark in both themes as on the phone. The
 * brand in the collapsed sidebar.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="next bank"
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-sm bg-icon-ground font-display text-xl leading-none font-bold tracking-[-0.04em] text-icon-letter',
        className,
      )}
    >
      n
      <span
        aria-hidden="true"
        className="ml-[0.08em] inline-block size-[0.28em] self-end rounded-full bg-mint mb-[0.18em]"
      />
    </span>
  );
}
