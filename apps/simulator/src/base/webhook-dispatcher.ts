import type pg from 'pg';
import type { Faults } from './faults.ts';
import { SIGNATURE_HEADER, signatureHeader } from './webhook-signer.ts';

/** Posts a webhook; true when the participant answered with success. */
export type Send = (url: string, body: string, headers: Record<string, string>) => Promise<boolean>;

export interface WebhookDispatcherDependencies {
  pool: pg.Pool;
  faults: Faults;
  clock: () => Date;
  webhook: { url: string; secret: Uint8Array };
  send: Send;
}

interface DueRow {
  id: string;
  event_id: string;
  attempts: number;
  end_to_end_id: string;
  payee_ispb: string | null;
  status: 'PENDING' | 'SETTLED' | 'REJECTED';
  reason: string | null;
  decided_at: Date | null;
}

/** A participant that does not answer gets the webhook again, up to this many times. */
const MAX_ATTEMPTS = 10;

/**
 * Delivers the webhooks the SPI owes (v1.2.0 plan, task 1). When a payment's
 * webhook is due, the SPI decides it (settled, or rejected when no bank holds
 * the key or the payee's bank is made to reject it) and tells the
 * participant: once, never (lost) or twice with the same event id
 * (duplicated), as the fault profile draws (D5). The body comes from the
 * payment, so every delivery of an event is the same.
 *
 * Each due delivery is locked with SKIP LOCKED, so two dispatchers never send
 * the same one; the transaction stays open while it sends, so the send must
 * time out well before the role's idle timeout (10 s).
 */
export class WebhookDispatcher {
  readonly #deps: WebhookDispatcherDependencies;

  constructor(deps: WebhookDispatcherDependencies) {
    this.#deps = deps;
  }

  /** Delivers the webhooks due now, at most [limit]; returns how many it handled. */
  async dispatchDue(limit = 20): Promise<number> {
    const { pool, clock } = this.#deps;
    const now = clock();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Served by webhook_deliveries_due_idx.
      const { rows } = await client.query<DueRow>(
        `SELECT d.id, d.event_id, d.attempts, p.end_to_end_id, p.payee_ispb,
                p.status, p.reason, p.decided_at
         FROM simulator.webhook_deliveries d
         JOIN simulator.payments p ON p.end_to_end_id = d.end_to_end_id
         WHERE d.status = 'PENDING' AND d.due_at <= $1
         ORDER BY d.due_at
         LIMIT $2
         FOR UPDATE OF d, p SKIP LOCKED`,
        [now, limit],
      );
      for (const row of rows) await this.#handle(client, row, now);
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async #handle(client: pg.PoolClient, row: DueRow, now: Date): Promise<void> {
    const decided = row.status === 'PENDING' ? await this.#decide(client, row, now) : row;
    // The fault is drawn once, at the first attempt; a retry is one delivery.
    const deliveries = row.attempts === 0 ? this.#deps.faults.webhookDeliveries() : 1;
    if (deliveries === 0) {
      await client.query(
        "UPDATE simulator.webhook_deliveries SET status = 'DROPPED' WHERE id = $1",
        [row.id],
      );
      return;
    }

    const body = JSON.stringify({
      eventId: row.event_id,
      version: 1,
      endToEndId: row.end_to_end_id,
      status: decided.status,
      ...(decided.reason ? { reason: decided.reason } : {}),
      occurredAt: (decided.decided_at ?? now).toISOString(),
    });
    const headers = {
      'content-type': 'application/json',
      [SIGNATURE_HEADER]: signatureHeader(
        this.#deps.webhook.secret,
        body,
        Math.floor(now.getTime() / 1000),
      ),
    };
    let delivered = false;
    for (let i = 0; i < deliveries; i++) {
      if (await this.#deps.send(this.#deps.webhook.url, body, headers)) delivered = true;
    }

    if (delivered) {
      await client.query(
        "UPDATE simulator.webhook_deliveries SET status = 'DELIVERED', delivered_at = $2, attempts = attempts + 1 WHERE id = $1",
        [row.id, now],
      );
      return;
    }
    const attempts = row.attempts + 1;
    // 5 s, 10 s, 20 s… up to 5 minutes between attempts.
    const backoffMs = Math.min(5_000 * 2 ** (attempts - 1), 300_000);
    await client.query(
      'UPDATE simulator.webhook_deliveries SET attempts = $2, due_at = $3, status = $4 WHERE id = $1',
      [
        row.id,
        attempts,
        new Date(now.getTime() + backoffMs),
        attempts >= MAX_ATTEMPTS ? 'DROPPED' : 'PENDING',
      ],
    );
  }

  async #decide(client: pg.PoolClient, row: DueRow, now: Date): Promise<DueRow> {
    const reason =
      row.payee_ispb === null
        ? 'PAYEE_KEY_NOT_FOUND'
        : this.#deps.faults.rejects()
          ? 'PAYEE_BANK_REJECTED'
          : null;
    const status = reason === null ? 'SETTLED' : 'REJECTED';
    await client.query(
      `UPDATE simulator.payments
       SET status = $2, reason = $3, decided_at = $4, settled_at = $5
       WHERE end_to_end_id = $1`,
      [row.end_to_end_id, status, reason, now, status === 'SETTLED' ? now : null],
    );
    return { ...row, status, reason, decided_at: now };
  }
}
