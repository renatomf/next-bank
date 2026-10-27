import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './helpers.ts';

// The scheduled and recurring Pix (v1.2.0 plan, task 7): a schedule keeps the
// payee as the Pix does (S1), active with its next occurrence or ended
// without one; each occurrence is paid once per date and sequence, by one
// Pix (EXT-05). The API never deletes either, and never changes what was
// scheduled nor an occurrence.
describe('Pix schedules schema', () => {
  const app = new pg.Client({ connectionString: testDatabaseUrl() });

  beforeAll(async () => {
    await app.connect();
  });
  afterAll(async () => {
    await app.end();
  });

  async function insert(table: string, row: Record<string, unknown>): Promise<void> {
    const names = Object.keys(row);
    await app.query(
      `INSERT INTO payments.${table} (${names.join(', ')})
       VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(', ')})`,
      Object.values(row),
    );
  }

  async function insertSchedule(columns: Record<string, unknown> = {}): Promise<string> {
    const row: Record<string, unknown> = {
      id: randomUUID(),
      payer_account_id: randomUUID(),
      payee_account_id: randomUUID(),
      payee_key_type: 'CPF',
      payee_key_masked: '***.842.917-**',
      payee_name: 'Marina Costa',
      payee_document_masked: '***.842.917-**',
      amount: 15_000,
      currency: 'BRL',
      description: null,
      first_date: '2026-11-05',
      frequency: 'MONTHLY',
      times: 3,
      status: 'ACTIVE',
      next_sequence: 1,
      next_occurrence_date: '2026-11-05',
      version: 0,
      created_at: new Date('2026-10-27T15:00:00Z'),
      cancelled_at: null,
      updated_at: new Date('2026-10-27T15:00:00Z'),
      ...columns,
    };
    await insert('pix_schedules', row);
    return String(row.id);
  }

  async function insertTransfer(): Promise<string> {
    const id = randomUUID();
    await insert('pix_transfers', {
      id,
      end_to_end_id: null,
      payer_account_id: randomUUID(),
      payee_account_id: randomUUID(),
      payee_key_type: 'CPF',
      payee_key_masked: '***.842.917-**',
      payee_name: 'Marina Costa',
      payee_document_masked: '***.842.917-**',
      amount: 15_000,
      currency: 'BRL',
      status: 'AWAITING_AUTH',
      version: 0,
      created_at: new Date('2026-11-05T12:00:00Z'),
      expires_at: new Date('2026-11-05T12:10:00Z'),
      updated_at: new Date('2026-11-05T12:00:00Z'),
    });
    return id;
  }

  async function insertOccurrence(
    scheduleId: string,
    columns: Record<string, unknown> = {},
  ): Promise<void> {
    await insert('pix_schedule_occurrences', {
      id: randomUUID(),
      schedule_id: scheduleId,
      sequence: 1,
      occurrence_date: '2026-11-05',
      transfer_id: await insertTransfer(),
      executed_at: new Date('2026-11-05T12:00:00Z'),
      ...columns,
    });
  }

  const external = {
    payee_account_id: null,
    payee_ispb: '99900001',
    payee_bank_name: 'Banco Aurora',
    payee_key_ciphertext: randomBytes(48),
    payee_key_version: 1,
  };

  it('takes a schedule to next bank or to another bank, never both nor neither', async () => {
    await expect(insertSchedule()).resolves.toBeTypeOf('string');
    await expect(insertSchedule(external)).resolves.toBeTypeOf('string');
    await expect(insertSchedule({ ...external, payee_account_id: randomUUID() })).rejects.toThrow(
      /one_payee/,
    );
    await expect(insertSchedule({ ...external, payee_ispb: null })).rejects.toThrow(/check/);
  });

  it('refuses the payer as payee, and an amount that is not positive', async () => {
    const account = randomUUID();

    await expect(
      insertSchedule({ payer_account_id: account, payee_account_id: account }),
    ).rejects.toThrow(/payer_payee/);
    await expect(insertSchedule({ amount: 0 })).rejects.toThrow(/amount/);
  });

  // S2: once is once; monthly is 2 to 24 times.
  it.each([
    ['ONCE', 1, true],
    ['ONCE', 2, false],
    ['MONTHLY', 2, true],
    ['MONTHLY', 24, true],
    ['MONTHLY', 1, false],
    ['MONTHLY', 25, false],
    ['WEEKLY', 2, false],
  ])('takes %s %s times: %s', async (frequency, times, takes) => {
    const insertion = insertSchedule({ frequency, times, next_sequence: 1 });

    await (takes
      ? expect(insertion).resolves.toBeTypeOf('string')
      : expect(insertion).rejects.toThrow(/check/));
  });

  it('keeps the next occurrence only while active, within the times', async () => {
    await expect(
      insertSchedule({ status: 'FINISHED', next_sequence: null, next_occurrence_date: null }),
    ).resolves.toBeTypeOf('string');
    await expect(insertSchedule({ status: 'FINISHED' })).rejects.toThrow(/next_check/);
    await expect(insertSchedule({ next_occurrence_date: null })).rejects.toThrow(/next_check/);
    await expect(insertSchedule({ next_sequence: 4 })).rejects.toThrow(/next_check/);
  });

  it('has a cancellation date if and only if cancelled', async () => {
    const ended = { next_sequence: null, next_occurrence_date: null };

    await expect(
      insertSchedule({ ...ended, status: 'CANCELLED', cancelled_at: new Date() }),
    ).resolves.toBeTypeOf('string');
    await expect(insertSchedule({ ...ended, status: 'CANCELLED' })).rejects.toThrow(
      /cancelled_check/,
    );
  });

  // EXT-05: one occurrence per date and per sequence, each by its own Pix.
  it('pays an occurrence once per date and per sequence', async () => {
    const scheduleId = await insertSchedule();
    await insertOccurrence(scheduleId);

    await expect(insertOccurrence(scheduleId, { sequence: 2 })).rejects.toThrow(
      /schedule_id_occurrence_date_key/,
    );
    await expect(insertOccurrence(scheduleId, { occurrence_date: '2026-12-05' })).rejects.toThrow(
      /schedule_id_sequence_key/,
    );
  });

  it('pays an occurrence with a Pix that pays no other', async () => {
    const transferId = await insertTransfer();
    const first = await insertSchedule();
    const second = await insertSchedule();
    await insertOccurrence(first, { transfer_id: transferId });

    await expect(insertOccurrence(second, { transfer_id: transferId })).rejects.toThrow(
      /transfer_id_key/,
    );
  });

  it('refuses an occurrence of no schedule, or paid by no Pix', async () => {
    await expect(insertOccurrence(randomUUID())).rejects.toThrow(/foreign key/);
    await expect(
      insertOccurrence(await insertSchedule(), { transfer_id: randomUUID() }),
    ).rejects.toThrow(/foreign key/);
  });

  it('lets the API move a schedule on, and nothing else', async () => {
    const scheduleId = await insertSchedule();
    await insertOccurrence(scheduleId);

    await expect(
      app.query(
        `UPDATE payments.pix_schedules
         SET next_sequence = 2, next_occurrence_date = '2026-12-05', version = 1,
             updated_at = now()
         WHERE id = $1`,
        [scheduleId],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
    for (const statement of [
      'UPDATE payments.pix_schedules SET amount = 1 WHERE id = $1',
      'UPDATE payments.pix_schedules SET payee_account_id = gen_random_uuid() WHERE id = $1',
      'DELETE FROM payments.pix_schedules WHERE id = $1',
      'UPDATE payments.pix_schedule_occurrences SET sequence = 9 WHERE schedule_id = $1',
      'DELETE FROM payments.pix_schedule_occurrences WHERE schedule_id = $1',
    ]) {
      await expect(app.query(statement, [scheduleId])).rejects.toThrow(/permission denied/);
    }
  });
});
