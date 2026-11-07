import { Clock, Hourglass, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { deadlineOf } from './deadline';

// No amber among the tokens: the icon and the weight tell "soon" from "calm",
// and the words always go along (brief, section 8).
const LOOKS = {
  calm: { icon: Clock, className: 'text-muted-foreground' },
  soon: { icon: Hourglass, className: 'font-semibold text-foreground' },
  urgent: { icon: TriangleAlert, className: 'font-semibold text-danger' },
  expired: { icon: Hourglass, className: 'text-muted-foreground' },
} as const;

/** How long a request has before it expires (home plan, H3). */
export function DeadlineBadge({ expiresAt, now }: { expiresAt: string; now: Date }) {
  const { tone, text } = deadlineOf(expiresAt, now);
  const { icon: Icon, className } = LOOKS[tone];
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon aria-hidden="true" />
      {text}
    </Badge>
  );
}
