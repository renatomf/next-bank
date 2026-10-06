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
