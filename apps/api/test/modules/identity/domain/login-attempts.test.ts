import { describe, expect, it } from 'vitest';
import { TooManyAttempts } from '../../../../src/modules/identity/domain/errors.ts';
import { LoginAttempts } from '../../../../src/modules/identity/domain/login-attempts.ts';

// Per-account protection against brute force (AUTH-01): 5 wrong attempts within
// 1 minute block the account's logins; each further block doubles, up to 15 minutes.
const START = new Date('2026-10-06T12:00:00.000Z');
const SECOND = 1_000;
const MINUTE = 60 * SECOND;

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

function failTimes(attempts: LoginAttempts, times: number, now: Date): void {
  for (let i = 0; i < times; i++) attempts.recordFailure(now);
}

describe('LoginAttempts', () => {
  it('allows 5 wrong attempts and blocks the 6th within a minute', () => {
    const attempts = LoginAttempts.none();
    failTimes(attempts, 4, START);

    expect(() => {
      attempts.assertAllowed(START);
    }).not.toThrow();
    attempts.recordFailure(START);
    expect(() => {
      attempts.assertAllowed(at(SECOND));
    }).toThrow(TooManyAttempts);
  });

  it('forgets wrong attempts older than a minute (sliding window)', () => {
    const attempts = LoginAttempts.none();
    failTimes(attempts, 4, START);

    attempts.recordFailure(at(MINUTE + 1));

    expect(() => {
      attempts.assertAllowed(at(MINUTE + 2));
    }).not.toThrow();
  });

  it('lifts the first block after 1 minute', () => {
    const attempts = LoginAttempts.none();
    failTimes(attempts, 5, START);

    expect(() => {
      attempts.assertAllowed(at(MINUTE - 1));
    }).toThrow(TooManyAttempts);
    expect(() => {
      attempts.assertAllowed(at(MINUTE));
    }).not.toThrow();
  });

  it('doubles each further block: 1, 2, 4, 8 minutes, then at most 15', () => {
    const attempts = LoginAttempts.none();
    let now = START;
    const blocks: number[] = [];
    for (let block = 0; block < 6; block++) {
      failTimes(attempts, 5, now);
      const until = attempts.state.blockedUntil ?? now;
      blocks.push((until.getTime() - now.getTime()) / MINUTE);
      now = until;
    }

    expect(blocks).toEqual([1, 2, 4, 8, 15, 15]);
  });

  it('starts over after a successful login', () => {
    const attempts = LoginAttempts.none();
    failTimes(attempts, 5, START);
    failTimes(attempts, 5, at(MINUTE));

    attempts.recordSuccess();
    failTimes(attempts, 5, at(10 * MINUTE));

    expect(attempts.state.blockedUntil).toEqual(at(11 * MINUTE));
  });

  it('carries the catalog code', () => {
    const attempts = LoginAttempts.none();
    failTimes(attempts, 5, START);

    expect(() => {
      attempts.assertAllowed(START);
    }).toThrow(expect.objectContaining({ code: 'TooManyAttempts' }));
  });

  it('can be restored with the same state', () => {
    const original = LoginAttempts.none();
    failTimes(original, 3, START);

    expect(LoginAttempts.restore(original.state).state).toEqual(original.state);
  });
});
