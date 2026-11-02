import { cn } from '@/lib/utils';

/**
 * The wordmark (brief, section 6): Sora 700, tracking -4%, and a mint dot on
 * the baseline, close to the last letter, a fifth of the type size.
 */
function Wordmark({ text, className }: { text: string; className?: string | undefined }) {
  return (
    <span
      role="img"
      aria-label="next bank"
      className={cn('font-display font-bold tracking-[-0.04em] text-foreground', className)}
    >
      {text}
      <span
        aria-hidden="true"
        className="ml-[0.06em] inline-block size-[0.2em] rounded-full bg-mint align-baseline"
      />
    </span>
  );
}

/** "next." in full. */
export function Logo({ className }: { className?: string }) {
  return <Wordmark text="next" className={className} />;
}

/** "n.", as on the app's launcher icon: the brand in the collapsed sidebar. */
export function LogoMark({ className }: { className?: string }) {
  return <Wordmark text="n" className={className} />;
}
