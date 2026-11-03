import { CircleCheck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ReconciliationException } from '@/lib/api';
import { OUTCOME_LABELS } from '@/lib/staff-words';
import { cn } from '@/lib/utils';

/** Open, or how it was resolved, with its icon and its word: never color alone (brief, section 8). */
export function ExceptionStatusBadge({ exception }: { exception: ReconciliationException }) {
  const { resolution } = exception;
  const Icon = resolution ? CircleCheck : Clock;
  return (
    <Badge variant="outline" className={cn('gap-1', resolution ? 'text-success' : 'text-link')}>
      <Icon aria-hidden="true" />
      {resolution ? OUTCOME_LABELS[resolution.outcome] : 'Aberta'}
    </Badge>
  );
}
