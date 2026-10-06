import pg from 'pg';
import type { TransactionPinsRepository } from '../application/ports.ts';
import { PinAlreadyCreated } from '../domain/errors.ts';
import type { TransactionPinState } from '../domain/transaction-pin.ts';

const UNIQUE_VIOLATION = '23505';

export class PgTransactionPinsRepository implements TransactionPinsRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(pin: TransactionPinState): Promise<void> {
    try {
      await this.#client.query(
        `INSERT INTO identity.transaction_pins
           (user_id, pin_hash, failed_attempts, locked_until, recent_locks, reset_required, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          pin.userId,
          pin.pinHash,
          pin.failedAttempts,
          pin.lockedUntil,
          pin.recentLocks,
          pin.resetRequired,
          pin.updatedAt,
        ],
      );
    } catch (error) {
      // The primary key on user_id decides when two creations race.
      if (
        error instanceof pg.DatabaseError &&
        error.code === UNIQUE_VIOLATION &&
        error.constraint === 'transaction_pins_pkey'
      ) {
        throw new PinAlreadyCreated();
      }
      throw error;
    }
  }
}
