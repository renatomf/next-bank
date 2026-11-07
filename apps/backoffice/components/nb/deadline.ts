/** How close a request is to expiring, from calm to already gone. */
export type DeadlineTone = 'calm' | 'soon' | 'urgent' | 'expired';

export interface Deadline {
  tone: DeadlineTone;
  text: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * The time left before a request expires (home plan, H3). A request lasts
 * 24 hours (K4): more than 12 left is calm, more than 4 is soon, less is
 * urgent. The words always go with the tone, never the color alone.
 */
export function deadlineOf(expiresAt: string, now: Date): Deadline {
  const left = new Date(expiresAt).getTime() - now.getTime();
  if (left <= 0) return { tone: 'expired', text: 'vencido' };
  const tone = left > 12 * HOUR ? 'calm' : left > 4 * HOUR ? 'soon' : 'urgent';
  const text =
    left < HOUR
      ? `vence em ${String(Math.ceil(left / MINUTE))} min`
      : `vence em ${String(Math.floor(left / HOUR))} h`;
  return { tone, text };
}
