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
        className="ml-[0.14em] inline-block size-[0.2em] translate-y-px rounded-full bg-mint"
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
        'inline-grid size-9 place-items-center rounded-md bg-icon-ground font-display text-xl leading-none font-bold tracking-[-0.04em] text-icon-letter',
        className,
      )}
    >
      {/* The dot sits on the letter's baseline, right after the "n"; the pair
          moves 2 px right, where it looks centered in the tile. */}
      <span className="inline-flex translate-x-0.5 items-baseline">
        n
        <span
          aria-hidden="true"
          className="ml-[0.12em] inline-block size-[0.24em] rounded-full bg-mint"
        />
      </span>
    </span>
  );
}
