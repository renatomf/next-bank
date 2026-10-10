import { PasswordIncorrect } from '../domain/errors.ts';
import { LoginAttempts } from '../domain/login-attempts.ts';
import type { Credentials, LoginAttemptsStore, SecretHasher } from './ports.ts';

/**
 * Checks the signed-in customer's password on the login's counter (AUTH-01).
 * The attempt is counted before any await (F-11), so a burst cannot slip past
 * the limit while earlier guesses are still hashing; the right password clears
 * it, as a login does.
 */
export async function confirmPassword(
  deps: { hasher: SecretHasher; attempts: LoginAttemptsStore },
  credentials: Credentials,
  password: string,
  now: Date,
): Promise<void> {
  const stored = deps.attempts.get(credentials.email);
  const attempts = stored ? LoginAttempts.restore(stored) : LoginAttempts.none();
  attempts.assertAllowed(now);
  attempts.recordFailure(now);
  deps.attempts.set(credentials.email, attempts.state);

  if (!(await deps.hasher.verify(credentials.passwordHash, password))) {
    throw new PasswordIncorrect();
  }
  deps.attempts.delete(credentials.email);
}
