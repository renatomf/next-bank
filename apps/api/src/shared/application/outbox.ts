import type { Transaction } from './ports.ts';

/**
 * What a message carries: ids and codes only, flat (O1). The handler reads
 * the rest from the database, so nothing personal ever sits in the queue
 * (API-04).
 */
export type OutboxPayload = Readonly<Record<string, string | number>>;

/** A message a command must still deliver to the outside world. */
export interface OutboxMessage {
  /** `module.action`, e.g. `pix.send-external`. */
  type: string;
  payload: OutboxPayload;
  /** The request that wrote it, for the end-to-end trace. */
  requestId: string | null;
}

/**
 * The transactional outbox (ADR 0016): the message is written in the
 * command's own transaction, so it exists exactly when what the command
 * decided does.
 */
export interface Outbox {
  enqueue(tx: Transaction, message: OutboxMessage): Promise<void>;
}

/** A message as a handler receives it. */
export interface DeliveredMessage {
  id: string;
  type: string;
  payload: OutboxPayload;
  /** How many times it was tried before. */
  attempts: number;
}

/**
 * Delivers one message; throws to have it tried again. Delivery is at least
 * once (a worker may die after the handler ran), so every handler must be
 * idempotent: the message id is the key.
 */
export type OutboxHandler = (message: DeliveredMessage) => Promise<void>;

/** Ten attempts in all, about 8.5 minutes, then a person decides (EXT-08). */
export const MAX_OUTBOX_ATTEMPTS = 10;

/** When a message that just failed for the [attempts]-th time is tried again, if ever. */
export function nextDelivery(
  attempts: number,
  now: Date,
): { status: 'PENDING'; availableAt: Date } | { status: 'DEAD' } {
  if (attempts >= MAX_OUTBOX_ATTEMPTS) return { status: 'DEAD' };
  // 1 s, 2 s, 4 s… doubling after each failure.
  return { status: 'PENDING', availableAt: new Date(now.getTime() + 1_000 * 2 ** (attempts - 1)) };
}
