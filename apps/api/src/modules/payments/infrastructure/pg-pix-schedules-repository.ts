import type pg from 'pg';
import { Money } from '../../../shared/domain/money.ts';
import type {
  PixSchedulesRepository,
  ScheduleOccurrence,
  SchedulePosition,
  SealedKeyValue,
} from '../application/ports.ts';
import type { PixKeyType } from '../domain/pix-key.ts';
import type { PixScheduleState, PixScheduleStatus } from '../domain/pix-schedule.ts';
import type { PixFailureReason, PixTransferStatus } from '../domain/pix-transfer.ts';

export class PgPixSchedulesRepository implements PixSchedulesRepository {
  readonly #client: pg.ClientBase;

  constructor(client: pg.ClientBase) {
    this.#client = client;
  }

  async insert(schedule: PixScheduleState, payeeKey?: SealedKeyValue): Promise<void> {
    await this.#client.query(
      `INSERT INTO payments.pix_schedules
         (id, payer_account_id, payee_account_id, payee_ispb, payee_bank_name,
          payee_key_ciphertext, payee_key_version, payee_key_type, payee_key_masked, payee_name,
          payee_document_masked, amount, currency, description, first_date, frequency, times,
          status, next_sequence, next_occurrence_date, version, created_at, cancelled_at,
          updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
               $19, $20, $21, $22, $23, $24)`,
      [
        schedule.id,
        schedule.payerAccountId,
        schedule.payee.accountId,
        schedule.payee.bank?.ispb ?? null,
        schedule.payee.bank?.name ?? null,
        payeeKey?.ciphertext ?? null,
        payeeKey?.keyVersion ?? null,
        schedule.payee.keyType,
        schedule.payee.keyMasked,
        schedule.payee.name,
        schedule.payee.documentMasked,
        schedule.amount.cents.toString(),
        schedule.amount.currency,
        schedule.description,
        schedule.firstDate,
        schedule.recurrence.frequency,
        schedule.recurrence.frequency === 'ONCE' ? 1 : schedule.recurrence.times,
        schedule.status,
        schedule.nextSequence,
        schedule.nextOccurrenceDate,
        schedule.version,
        schedule.createdAt,
        schedule.cancelledAt,
        schedule.updatedAt,
      ],
    );
  }

  /** Served by the primary key; the payer filter makes another customer's schedule invisible. */
  async findForPayer(id: string, payerAccountId: string): Promise<PixScheduleState | null> {
    const { rows } = await this.#client.query<ScheduleRow>(
      `${SELECT_SCHEDULE} WHERE id = $1 AND payer_account_id = $2`,
      [id, payerAccountId],
    );
    return stateOf(rows[0]);
  }

  async lockForPayer(id: string, payerAccountId: string): Promise<PixScheduleState | null> {
    const { rows } = await this.#client.query<ScheduleRow>(
      `${SELECT_SCHEDULE} WHERE id = $1 AND payer_account_id = $2 FOR UPDATE`,
      [id, payerAccountId],
    );
    return stateOf(rows[0]);
  }

  /** Served by the pix_schedules_due_idx partial index. */
  async lockNextDue(
    today: string,
    skip: readonly string[],
  ): Promise<{ schedule: PixScheduleState; payeeKey: SealedKeyValue | null } | null> {
    const { rows } = await this.#client.query<
      ScheduleRow & { payee_key_ciphertext: Uint8Array | null; payee_key_version: number | null }
    >(
      `SELECT ${SCHEDULE_COLUMNS}, payee_key_ciphertext, payee_key_version
       FROM payments.pix_schedules
       WHERE status = 'ACTIVE' AND next_occurrence_date <= $1 AND id <> ALL($2::uuid[])
       ORDER BY next_occurrence_date
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [today, skip],
    );
    const row = rows[0];
    const schedule = stateOf(row);
    if (!row || !schedule) return null;
    const payeeKey =
      row.payee_key_ciphertext !== null && row.payee_key_version !== null
        ? { ciphertext: row.payee_key_ciphertext, keyVersion: row.payee_key_version }
        : null;
    return { schedule, payeeKey };
  }

  /** Only the schedule's progress moves; what was scheduled never changes (column grants). */
  async update(schedule: PixScheduleState): Promise<void> {
    await this.#client.query(
      `UPDATE payments.pix_schedules
       SET status = $2, next_sequence = $3, next_occurrence_date = $4, cancelled_at = $5,
           version = $6, updated_at = $7
       WHERE id = $1`,
      [
        schedule.id,
        schedule.status,
        schedule.nextSequence,
        schedule.nextOccurrenceDate,
        schedule.cancelledAt,
        schedule.version,
        schedule.updatedAt,
      ],
    );
  }

  /** A plain insert: the unique constraints fail a repeat, and the transaction undoes it. */
  async recordOccurrence(occurrence: {
    id: string;
    scheduleId: string;
    sequence: number;
    occurrenceDate: string;
    transferId: string;
    executedAt: Date;
  }): Promise<void> {
    await this.#client.query(
      `INSERT INTO payments.pix_schedule_occurrences
         (id, schedule_id, sequence, occurrence_date, transfer_id, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        occurrence.id,
        occurrence.scheduleId,
        occurrence.sequence,
        occurrence.occurrenceDate,
        occurrence.transferId,
        occurrence.executedAt,
      ],
    );
  }

  /** Served by the pix_schedules_payer_idx index. */
  async listForPayer(
    payerAccountId: string,
    after: SchedulePosition | null,
    limit: number,
  ): Promise<PixScheduleState[]> {
    const { rows } = await this.#client.query<ScheduleRow>(
      `${SELECT_SCHEDULE}
       WHERE payer_account_id = $1
         AND ($2::timestamptz IS NULL OR (created_at, id) < ($2, $3::uuid))
       ORDER BY created_at DESC, id DESC
       LIMIT $4`,
      [payerAccountId, after?.createdAt ?? null, after?.id ?? null, limit],
    );
    return rows.flatMap((row) => stateOf(row) ?? []);
  }

  /** Served by the schedule_id_sequence unique index; the outcome is the Pix's. */
  async occurrencesOf(scheduleId: string): Promise<ScheduleOccurrence[]> {
    const { rows } = await this.#client.query<{
      sequence: number;
      occurrence_date: string;
      transfer_id: string;
      status: PixTransferStatus;
      failure_reason: PixFailureReason | null;
      executed_at: Date;
    }>(
      `SELECT o.sequence, o.occurrence_date::text AS occurrence_date, o.transfer_id,
              t.status, t.failure_reason, o.executed_at
       FROM payments.pix_schedule_occurrences o
       JOIN payments.pix_transfers t ON t.id = o.transfer_id
       WHERE o.schedule_id = $1
       ORDER BY o.sequence`,
      [scheduleId],
    );
    return rows.map((row) => ({
      sequence: row.sequence,
      date: row.occurrence_date,
      transferId: row.transfer_id,
      status: row.status,
      failureReason: row.failure_reason,
      executedAt: row.executed_at,
    }));
  }
}

// Dates as text: a date read as a JavaScript Date would land on the server's
// midnight, not on the day of São Paulo.
const SCHEDULE_COLUMNS = `id, payer_account_id, payee_account_id, payee_ispb, payee_bank_name,
    payee_key_type, payee_key_masked, payee_name, payee_document_masked, amount, currency,
    description, first_date::text AS first_date, frequency, times, status, next_sequence,
    next_occurrence_date::text AS next_occurrence_date, version, created_at, cancelled_at,
    updated_at`;

const SELECT_SCHEDULE = `SELECT ${SCHEDULE_COLUMNS} FROM payments.pix_schedules`;

interface ScheduleRow {
  id: string;
  payer_account_id: string;
  payee_account_id: string | null;
  payee_ispb: string | null;
  payee_bank_name: string | null;
  payee_key_type: PixKeyType;
  payee_key_masked: string;
  payee_name: string;
  payee_document_masked: string;
  /** bigint arrives as a string: never through a JavaScript number (D1). */
  amount: string;
  currency: 'BRL';
  description: string | null;
  first_date: string;
  frequency: 'ONCE' | 'MONTHLY';
  times: number;
  status: PixScheduleStatus;
  next_sequence: number | null;
  next_occurrence_date: string | null;
  version: string;
  created_at: Date;
  cancelled_at: Date | null;
  updated_at: Date;
}

function stateOf(row: ScheduleRow | undefined): PixScheduleState | null {
  return row
    ? {
        id: row.id,
        payerAccountId: row.payer_account_id,
        payee: {
          accountId: row.payee_account_id,
          name: row.payee_name,
          documentMasked: row.payee_document_masked,
          keyType: row.payee_key_type,
          keyMasked: row.payee_key_masked,
          // The CHECK keeps the bank's columns null or set together (S1).
          ...(row.payee_ispb !== null && row.payee_bank_name !== null
            ? { bank: { ispb: row.payee_ispb, name: row.payee_bank_name } }
            : {}),
        },
        amount: Money.of(BigInt(row.amount), row.currency),
        description: row.description,
        firstDate: row.first_date,
        recurrence:
          row.frequency === 'ONCE'
            ? { frequency: 'ONCE' }
            : { frequency: 'MONTHLY', times: row.times },
        status: row.status,
        nextSequence: row.next_sequence,
        nextOccurrenceDate: row.next_occurrence_date,
        version: Number(row.version),
        createdAt: row.created_at,
        cancelledAt: row.cancelled_at,
        updatedAt: row.updated_at,
      }
    : null;
}
