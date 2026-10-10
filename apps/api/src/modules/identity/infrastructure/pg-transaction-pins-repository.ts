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

  async lockByUserId(userId: string): Promise<TransactionPinState | null> {
    const { rows } = await this.#client.query<PinRow>(
      `SELECT user_id, pin_hash, failed_attempts, locked_until, recent_locks, reset_required, updated_at
       FROM identity.transaction_pins WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    const row = rows[0];
    return row
      ? {
          userId: row.user_id,
          pinHash: row.pin_hash,
          failedAttempts: row.failed_attempts,
          lockedUntil: row.locked_until,
          recentLocks: row.recent_locks,
          resetRequired: row.reset_required,
          updatedAt: row.updated_at,
        }
      : null;
  }

  async update(pin: TransactionPinState): Promise<void> {
    await this.#client.query(
      `UPDATE identity.transaction_pins
       SET failed_attempts = $2, locked_until = $3, recent_locks = $4, reset_required = $5,
           updated_at = $6, pin_hash = $7
       WHERE user_id = $1`,
      [
        pin.userId,
        pin.failedAttempts,
        pin.lockedUntil,
        pin.recentLocks,
        pin.resetRequired,
        pin.updatedAt,
        pin.pinHash,
      ],
    );
  }
}

interface PinRow {
  user_id: string;
  pin_hash: string;
  failed_attempts: number;
  locked_until: Date | null;
  recent_locks: Date[];
  reset_required: boolean;
  updated_at: Date;
}
