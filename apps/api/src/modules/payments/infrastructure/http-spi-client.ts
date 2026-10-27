import { z } from 'zod';
import { Money } from '../../../shared/domain/money.ts';
import type { DictKey, SpiPayment, SpiPaymentStatus, SpiPort } from '../application/ports.ts';

/** The header the simulator reads the participant's key from (EXT-09). */
const PARTICIPANT_KEY_HEADER = 'x-participant-key';

// What the DICT answers is read, never trusted: anything else is an error.
const DictKeySchema = z.object({
  keyType: z.enum(['CPF', 'EMAIL', 'PHONE', 'RANDOM']),
  bank: z.object({ ispb: z.string().regex(/^[0-9]{8}$/), name: z.string().min(1).max(80) }),
  owner: z.object({ name: z.string().min(1).max(80), documentMasked: z.string().min(1).max(20) }),
});

const PaymentStatusSchema = z.object({ status: z.enum(['PENDING', 'SETTLED', 'REJECTED']) });

// The settlement file is read, never trusted: whole positive cents in reais.
const SettlementFileSchema = z.object({
  payments: z.array(
    z.object({
      endToEndId: z.string().regex(/^E[0-9]{8}[0-9]{12}[A-Za-z0-9]{11}$/),
      amount: z.object({ amount: z.int().positive(), currency: z.literal('BRL') }),
    }),
  ),
});

export interface HttpSpiClientOptions {
  /** SIMULATOR_URL: in production, the simulator on 127.0.0.1 (D2). */
  baseUrl: string;
  participantKey: string;
  /** A partner that does not answer in time is a failure, retried by the caller. */
  timeoutMs: number;
}

/**
 * The DICT and the SPI over HTTP. Errors carry only the status: never the
 * key looked up, which is personal data (API-04), nor the participant's key.
 */
export class HttpSpiClient implements SpiPort {
  readonly #options: HttpSpiClientOptions;

  constructor(options: HttpSpiClientOptions) {
    this.#options = options;
  }

  async findKey(key: string): Promise<DictKey | null> {
    const response = await this.#call('GET', `/dict/keys/${encodeURIComponent(key)}`);
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error(`DICT answered ${String(response.status)}`);
    const { keyType, bank, owner } = DictKeySchema.parse(await response.json());
    return { keyType, bank, owner };
  }

  async send(payment: SpiPayment): Promise<void> {
    const response = await this.#call(
      'POST',
      '/spi/payments',
      JSON.stringify({
        endToEndId: payment.endToEndId,
        // Cents fit a JSON number: the limits keep a Pix far below 2^53.
        amount: { amount: Number(payment.amount.cents), currency: payment.amount.currency },
        payer: payment.payer,
        payeeKey: payment.payeeKey,
      }),
    );
    // Drained so the connection is reused; the 202's body adds nothing.
    await response.body?.cancel();
    if (response.status !== 202) throw new Error(`SPI answered ${String(response.status)}`);
  }

  async status(endToEndId: string): Promise<SpiPaymentStatus | null> {
    const response = await this.#call('GET', `/spi/payments/${encodeURIComponent(endToEndId)}`);
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error(`SPI answered ${String(response.status)}`);
    return PaymentStatusSchema.parse(await response.json()).status;
  }

  /**
   * The payments the SPI settled on a day of São Paulo (`YYYY-MM-DD`), for
   * the daily reconciliation (v1.2.0 plan, task 6).
   */
  async settlementFile(date: string): Promise<{ endToEndId: string; amount: Money }[]> {
    const response = await this.#call('GET', `/settlements/${encodeURIComponent(date)}`);
    if (response.status !== 200) throw new Error(`SPI answered ${String(response.status)}`);
    const file = SettlementFileSchema.parse(await response.json());
    return file.payments.map((payment) => ({
      endToEndId: payment.endToEndId,
      amount: Money.of(BigInt(payment.amount.amount)),
    }));
  }

  #call(method: 'GET' | 'POST', path: string, json?: string): Promise<Response> {
    const { baseUrl, participantKey, timeoutMs } = this.#options;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        [PARTICIPANT_KEY_HEADER]: participantKey,
        ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(json === undefined ? {} : { body: json }),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
  }
}
