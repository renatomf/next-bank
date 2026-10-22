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

/** A delivery claimed to be sent: its body, and how many times to send it. */
interface Claimed {
  id: string;
  attempts: number;
  body: string;
  deliveries: 1 | 2;
}

/** A participant that does not answer gets the webhook again, up to this many times. */
const MAX_ATTEMPTS = 10;

/** How long a claim holds a delivery while it is sent; longer than any send. */
const CLAIM_MS = 30_000;

/**
 * Delivers the webhooks the SPI owes (v1.2.0 plan, task 1). When a payment's
 * webhook is due, the SPI decides it (settled, or rejected when no bank holds
 * the key or the payee's bank is made to reject it) and tells the
 * participant: once, never (lost) or twice with the same event id
 * (duplicated), as the fault profile draws (D5). The body comes from the
 * payment, so every delivery of an event is the same.
 *
 * No lock is held while the network is awaited: the due deliveries are
 * claimed in one short transaction (SKIP LOCKED, so two dispatchers never
 * claim the same one), sent with no transaction open, and their outcome
 * recorded in another. A claim left by a dispatcher that died runs out after
 * [CLAIM_MS], and the delivery is taken again.
 */
export class WebhookDispatcher {
  readonly #deps: WebhookDispatcherDependencies;

  constructor(deps: WebhookDispatcherDependencies) {
    this.#deps = deps;
  }

  /** Delivers the webhooks due now, at most [limit]; returns how many it claimed. */
  async dispatchDue(limit = 20): Promise<number> {
    const now = this.#deps.clock();
    const claimed = await this.#claim(now, limit);
    for (const delivery of claimed.toSend) {
      const delivered = await this.#send(delivery, now);
      await this.#record(delivery, delivered, now);
    }
    return claimed.count;
  }

  /** Decides the payments due, drops the lost webhooks and claims the rest. */
  async #claim(now: Date, limit: number): Promise<{ count: number; toSend: Claimed[] }> {
    return this.#transaction(async (client) => {
      // Served by webhook_deliveries_due_idx.
      const { rows } = await client.query<DueRow>(
        `SELECT d.id, d.event_id, d.attempts, p.end_to_end_id, p.payee_ispb,
                p.status, p.reason, p.decided_at
         FROM simulator.webhook_deliveries d
         JOIN simulator.payments p ON p.end_to_end_id = d.end_to_end_id
         WHERE d.status = 'PENDING' AND d.due_at <= $1
           AND (d.locked_until IS NULL OR d.locked_until <= $1)
         ORDER BY d.due_at
         LIMIT $2
         FOR UPDATE OF d, p SKIP LOCKED`,
        [now, limit],
      );
      const toSend: Claimed[] = [];
      for (const row of rows) {
        const decided = row.status === 'PENDING' ? await this.#decide(client, row, now) : row;
        // The fault is drawn once, at the first attempt; a retry is one delivery.
        const deliveries = row.attempts === 0 ? this.#deps.faults.webhookDeliveries() : 1;
        if (deliveries === 0) {
          await client.query(
            "UPDATE simulator.webhook_deliveries SET status = 'DROPPED' WHERE id = $1",
            [row.id],
          );
          continue;
        }
        await client.query(
          'UPDATE simulator.webhook_deliveries SET locked_until = $2 WHERE id = $1',
          [row.id, new Date(now.getTime() + CLAIM_MS)],
        );
        toSend.push({ id: row.id, attempts: row.attempts, body: bodyOf(decided, now), deliveries });
      }
      return { count: rows.length, toSend };
    });
  }

  async #send(delivery: Claimed, now: Date): Promise<boolean> {
    const headers = {
      'content-type': 'application/json',
      [SIGNATURE_HEADER]: signatureHeader(
        this.#deps.webhook.secret,
        delivery.body,
        Math.floor(now.getTime() / 1000),
      ),
    };
    let delivered = false;
    for (let i = 0; i < delivery.deliveries; i++) {
      if (await this.#deps.send(this.#deps.webhook.url, delivery.body, headers)) delivered = true;
    }
    return delivered;
  }

  async #record(delivery: Claimed, delivered: boolean, now: Date): Promise<void> {
    const attempts = delivery.attempts + 1;
    if (delivered) {
      await this.#deps.pool.query(
        `UPDATE simulator.webhook_deliveries
         SET status = 'DELIVERED', delivered_at = $2, attempts = $3, locked_until = NULL
         WHERE id = $1`,
        [delivery.id, now, attempts],
      );
      return;
    }
    // 5 s, 10 s, 20 s… up to 5 minutes between attempts.
    const backoffMs = Math.min(5_000 * 2 ** (attempts - 1), 300_000);
    await this.#deps.pool.query(
      `UPDATE simulator.webhook_deliveries
       SET attempts = $2, due_at = $3, status = $4, locked_until = NULL
       WHERE id = $1`,
      [
        delivery.id,
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

  async #transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#deps.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function bodyOf(row: DueRow, now: Date): string {
  return JSON.stringify({
    eventId: row.event_id,
    version: 1,
    endToEndId: row.end_to_end_id,
    status: row.status,
    ...(row.reason ? { reason: row.reason } : {}),
    occurredAt: (row.decided_at ?? now).toISOString(),
  });
}
