import { randomUUID } from 'node:crypto';
import type { TopUpProvider } from '../application/ports.ts';

/**
 * The operator of this version (D5): nothing reaches a real carrier, by the
 * rule of the version, and every top-up is confirmed at once with a reference
 * of its own. A provider that can fail, wait or reverse comes in phase 4.
 */
export class FakeTopUpProvider implements TopUpProvider {
  recharge(): Promise<{ reference: string }> {
    return Promise.resolve({ reference: `fake-${randomUUID()}` });
  }
}
