import { createHash, timingSafeEqual } from 'node:crypto';

/** The header where the participant presents its key. */
export const PARTICIPANT_KEY_HEADER = 'x-participant-key';

/**
 * Whether [presented] is the participant's key (EXT-09). Both are hashed
 * first, so the comparison takes the same time whatever their lengths.
 */
export function isParticipantKey(
  presented: string | string[] | undefined,
  expected: string,
): boolean {
  if (typeof presented !== 'string' || presented === '') return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
