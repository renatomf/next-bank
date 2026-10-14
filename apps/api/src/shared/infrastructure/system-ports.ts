import { randomUUID } from 'node:crypto';
import { v7 } from 'uuid';
import type { Clock, IdGenerator } from '../application/ports.ts';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** UUIDv7: time-ordered, so new rows land at the end of the primary key index. */
export class UuidV7Generator implements IdGenerator {
  next(): string {
    return v7();
  }
}

/**
 * UUIDv4 from the platform's CSPRNG: nothing in it can be guessed, unlike a v7,
 * which carries its creation time. For values that must be unpredictable.
 */
export class RandomUuidGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
