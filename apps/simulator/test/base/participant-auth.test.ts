import { describe, expect, it } from 'vitest';
import { isParticipantKey } from '../../src/base/participant-auth.ts';

// EXT-09: every route of the published simulator asks the participant's key,
// compared in constant time.
const key = 'k'.repeat(44);

describe('isParticipantKey', () => {
  it('takes the participant key', () => {
    expect(isParticipantKey(key, key)).toBe(true);
  });

  it.each([
    ['no key', undefined],
    ['an empty key', ''],
    ['another key', 'x'.repeat(44)],
    ['a shorter key', key.slice(1)],
    ['the key twice', [key, key]],
  ])('refuses %s', (_case, presented) => {
    expect(isParticipantKey(presented, key)).toBe(false);
  });
});
