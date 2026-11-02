import { CircleCheck, CircleX, Clock, Hourglass, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ApprovalRequest } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/staff-words';
import { cn } from '@/lib/utils';

const LOOKS = {
  PENDING: { icon: Clock, className: 'text-link' },
  APPROVED: { icon: CircleCheck, className: 'text-success' },
  REJECTED: { icon: CircleX, className: 'text-danger' },
  CANCELLED: { icon: Undo2, className: 'text-muted-foreground' },
  EXPIRED: { icon: Hourglass, className: 'text-muted-foreground' },
} as const;

/** A request's status, with its icon and its word: never color alone (brief, section 8). */
export function RequestStatusBadge({ status }: { status: ApprovalRequest['status'] }) {
  const { icon: Icon, className } = LOOKS[status];
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
