import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { buildSimulator } from '../src/app.ts';
import { type FaultProfile, Faults, NO_FAULTS, seededRandom } from '../src/base/faults.ts';
import { PARTICIPANT_KEY_HEADER } from '../src/base/participant-auth.ts';

/** A throwaway participant key for the tests. */
export const participantKey = randomBytes(32).toString('base64');

export const withKey = { [PARTICIPANT_KEY_HEADER]: participantKey };

/** next bank's made-up ISPB, as the payer. */
export const NEXT_BANK_ISPB = '00099999';

/** A seeded key of the made-up Banco Aurora (seed of the simulator schema). */
export const AURORA_KEY = 'clara.aurora@example.com';

/** A fresh end-to-end id in the Bacen's format: E + ISPB + time + 11 characters. */
export function newEndToEndId(): string {
  const suffix = randomBytes(8).toString('hex').slice(0, 11);
  return `E${NEXT_BANK_ISPB}202610221500${suffix}`;
}

/** A payment as the API would send it; [changes] replace fields. */
export function paymentRequest(changes: Record<string, unknown> = {}) {
  return {
    endToEndId: newEndToEndId(),
    amount: { amount: 1000, currency: 'BRL' },
    payer: { ispb: NEXT_BANK_ISPB, name: 'Ana Demo', documentMasked: '***.444.777-**' },
    payeeKey: AURORA_KEY,
    ...changes,
  };
}

export function simulatorFor(
  pool: pg.Pool,
  options: { profile?: Partial<FaultProfile>; logStream?: { write(line: string): void } } = {},
) {
  return buildSimulator({
    pool,
    participantKey,
    faults: new Faults({ ...NO_FAULTS, ...options.profile }, seededRandom(1)),
    ...(options.logStream ? { logStream: options.logStream } : {}),
  });
}
