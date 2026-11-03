'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { REASON_LABELS } from '@/lib/staff-words';
import { useMounted } from '@/lib/use-mounted';

/** Why the staff acts: a code from the list, never free text (task 4). */
export function ReasonField({ id = 'reason' }: { id?: string }) {
  // Drawn in the browser only: Radix's hidden form select carries an inline style.
  const mounted = useMounted();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Motivo</Label>
      {mounted ? (
        <Select name="reason" required>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Escolha o motivo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(REASON_LABELS).map(([code, label]) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div aria-hidden="true" className="h-9 rounded-md border border-input bg-card" />
      )}
    </div>
  );
}
