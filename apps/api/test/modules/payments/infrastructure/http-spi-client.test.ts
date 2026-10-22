import { afterEach, describe, expect, it } from 'vitest';
import type { SpiPayment } from '../../../../src/modules/payments/application/ports.ts';
import { CryptoEndToEndIds } from '../../../../src/modules/payments/infrastructure/crypto-end-to-end-ids.ts';
import { HttpSpiClient } from '../../../../src/modules/payments/infrastructure/http-spi-client.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import {
  AURORA_KEY,
  participantKey,
  type RunningSimulator,
  startSimulator,
} from '../../../simulator.ts';

// The API's side of the DICT and the SPI (v1.2.0 plan, task 3), against the
// real simulator mounted as in production: the participant's key on every
// call (EXT-09), a short deadline, and a payment sent with its end-to-end id,
// so sending it again after a timeout is still one payment (EXT-03).
let simulator: RunningSimulator | undefined;

afterEach(async () => {
  await simulator?.close();
  simulator = undefined;
});

async function clientFor(faults: Record<string, number> = {}, key = participantKey) {
  simulator = await startSimulator(faults);
  return new HttpSpiClient({ baseUrl: simulator.url, participantKey: key, timeoutMs: 300 });
}

function payment(changes: Partial<SpiPayment> = {}): SpiPayment {
  return {
    endToEndId: new CryptoEndToEndIds().next(new Date()),
    amount: Money.of(5_000n),
    payer: { ispb: '00000000', name: 'Ana Demo', documentMasked: '***.444.777-**' },
    payeeKey: AURORA_KEY,
    ...changes,
  };
}

async function paymentsWith(endToEndId: string): Promise<number> {
  if (!simulator) throw new Error('no simulator running');
  const { rows } = await simulator.pool.query<{ count: string }>(
    'SELECT count(*) FROM simulator.payments WHERE end_to_end_id = $1',
    [endToEndId],
  );
  return Number(rows[0]?.count);
}

describe('HttpSpiClient', () => {
  it("finds another bank's key in the DICT, with its bank and masked owner", async () => {
    const spi = await clientFor();

    await expect(spi.findKey(AURORA_KEY)).resolves.toEqual({
      keyType: 'EMAIL',
      bank: { ispb: '99900001', name: 'Banco Aurora' },
      owner: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
    });
  });

  it('finds nothing for a key no bank has', async () => {
    const spi = await clientFor();

    await expect(spi.findKey('ninguem@example.com')).resolves.toBeNull();
  });

  it('keeps a key with reserved characters inside its path segment', async () => {
    const spi = await clientFor();

    await expect(spi.findKey('../spi/payments')).resolves.toBeNull();
  });

  it('sends a payment the SPI takes, once however often it goes', async () => {
    const spi = await clientFor();
    const sent = payment();

    await spi.send(sent);
    await spi.send(sent);

    expect(await paymentsWith(sent.endToEndId)).toBe(1);
  });

  it('fails when the same end-to-end id comes with another payment', async () => {
    const spi = await clientFor();
    const sent = payment();
    await spi.send(sent);

    await expect(spi.send({ ...sent, amount: Money.of(9_000n) })).rejects.toThrow(/409/);
  });

  it('fails when the SPI answers with an error, so the outbox sends it again', async () => {
    const spi = await clientFor({ errorRate: 1 });
    const sent = payment();

    await expect(spi.send(sent)).rejects.toThrow(/503/);
    expect(await paymentsWith(sent.endToEndId)).toBe(0);
  });

  it('fails on a dropped answer, and sending again is still one payment (EXT-03)', async () => {
    const spi = await clientFor({ timeoutRate: 1 });
    const sent = payment();

    await expect(spi.send(sent)).rejects.toThrow();
    await expect(spi.send(sent)).rejects.toThrow();
    expect(await paymentsWith(sent.endToEndId)).toBe(1);
  });

  it('gives up after its deadline', async () => {
    const spi = await clientFor({ latencyMs: 1_000 });

    await expect(spi.findKey(AURORA_KEY)).rejects.toThrow(/timeout|aborted/i);
  });

  it("is refused without the participant's key (EXT-09)", async () => {
    const spi = await clientFor({}, 'not-the-key');

    await expect(spi.findKey(AURORA_KEY)).rejects.toThrow(/401/);
    await expect(spi.send(payment())).rejects.toThrow(/401/);
  });

  it('never puts the key it looked up in an error', async () => {
    const spi = await clientFor({ errorRate: 1 }, 'not-the-key');

    await expect(spi.findKey(AURORA_KEY)).rejects.not.toThrow(/clara/);
  });
});
