import { CircleCheck, CircleX, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TONES = {
  ok: { icon: CircleCheck, className: 'text-success' },
  blocked: { icon: Lock, className: 'text-danger' },
  closed: { icon: CircleX, className: 'text-muted-foreground' },
} as const;

/** A status with its icon and its word: never color alone (brief, section 8). */
export function StatusBadge({ tone, label }: { tone: keyof typeof TONES; label: string }) {
  const { icon: Icon, className } = TONES[tone];
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
