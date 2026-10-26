import { describe, expect, it } from 'vitest';
import { ApplySpiOutcome } from '../../../../src/modules/payments/application/apply-spi-outcome.ts';
import { CheckPendingPix } from '../../../../src/modules/payments/application/check-pending-pix.ts';
import { PixTransfer } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeOutbox, FakeSpi, FakeUnitOfWork, twoCustomers } from './fakes.ts';

// The status check (v1.2.0 plan, task 4; EXT-03, W2, W3): a Pix to another
// bank still waiting for the SPI after 2 minutes is asked about. Settled or
// refused, it ends as by the webhook; unknown to the SPI, it is sent again
// with the same end-to-end id; pending or unanswered, nothing changes (D6).
const NOW = new Date('2026-10-26T15:10:00.000Z');

function waitingPix(id: string, authorizedAt: Date, endToEndId: string) {
  const transfer = PixTransfer.create({
    id,
    payerAccountId: 'account-a',
    payee: {
      accountId: null,
      bank: { ispb: '99900001', name: 'Banco Aurora' },
      name: 'Clara Aurora Teixeira',
      documentMasked: '***.407.256-**',
      keyType: 'EMAIL',
      keyMasked: 'cl***@example.com',
    },
    amount: Money.of(1_000n),
    description: null,
    now: new Date(authorizedAt.getTime() - 60_000),
  });
  transfer.startProcessing(authorizedAt);
  transfer.awaitSettlement(endToEndId);
  return transfer.state;
}

const e2e = (n: number) => `E00000000202610261500${String(n).padStart(11, '0')}`;
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function setup() {
  const world = twoCustomers();
  const spi = new FakeSpi();
  const outbox = new FakeOutbox();
  const unitOfWork = new FakeUnitOfWork();
  const clock = new FixedClock(NOW);
  const check = new CheckPendingPix({
    unitOfWork,
    repositories: world.repositories,
    spi,
    outbox,
    applySpiOutcome: new ApplySpiOutcome({
      unitOfWork,
      repositories: world.repositories,
      ledger: world.ledger,
      clock,
      ids: new SequentialIds(),
    }),
    clock,
  });
  return { ...world, spi, outbox, check };
}

describe('CheckPendingPix', () => {
  it('ends a Pix the SPI settled or refused, as the webhook would', async () => {
    const { repositories, ledger, spi, check } = setup();
    repositories.transfers.push(waitingPix('pix-1', minutesAgo(5), e2e(1)));
    repositories.transfers.push(waitingPix('pix-2', minutesAgo(5), e2e(2)));
    spi.statuses.set(e2e(1), 'SETTLED');
    spi.statuses.set(e2e(2), 'REJECTED');

    await check.execute();

    expect(repositories.transfers.map((t) => t.status)).toEqual(['COMPLETED', 'FAILED']);
    expect(ledger.settled.map((s) => s.transferId)).toEqual(['pix-1']);
    expect(ledger.refunded.map((r) => r.transferId)).toEqual(['pix-2']);
  });

  it('leaves a Pix the SPI has not decided yet', async () => {
    const { repositories, ledger, spi, outbox, check } = setup();
    repositories.transfers.push(waitingPix('pix-1', minutesAgo(5), e2e(1)));
    spi.statuses.set(e2e(1), 'PENDING');

    await check.execute();

    expect(repositories.transfers[0]?.status).toBe('PROCESSING');
    expect(ledger.settled).toEqual([]);
    expect(outbox.messages).toEqual([]);
  });

  // W3: the SPI takes the same end-to-end id once, so sending again is safe.
  it('sends again a Pix the SPI never got, and never refunds it', async () => {
    const { repositories, ledger, outbox, check } = setup();
    repositories.transfers.push(waitingPix('pix-1', minutesAgo(5), e2e(1)));

    await check.execute();

    expect(outbox.messages).toEqual([
      { type: 'pix.send-external', payload: { transferId: 'pix-1' }, requestId: null },
    ]);
    expect(repositories.transfers[0]?.status).toBe('PROCESSING');
    expect(ledger.refunded).toEqual([]);
  });

  // W2: the webhook has 2 minutes to come before the SPI is asked.
  it('does not ask about a Pix authorized less than 2 minutes ago', async () => {
    const { repositories, spi, check } = setup();
    repositories.transfers.push(waitingPix('pix-1', minutesAgo(1), e2e(1)));

    await check.execute();

    expect(spi.asked).toEqual([]);
  });

  // EXT-08, D6: an SPI that does not answer decides nothing.
  it('changes nothing when the SPI does not answer, and tries again next round', async () => {
    const { repositories, ledger, spi, outbox, check } = setup();
    repositories.transfers.push(waitingPix('pix-1', minutesAgo(5), e2e(1)));
    spi.down = true;

    await expect(check.execute()).resolves.toBe(1);

    expect(repositories.transfers[0]?.status).toBe('PROCESSING');
    expect(ledger.refunded).toEqual([]);
    expect(outbox.messages).toEqual([]);
  });

  it('asks about at most 20 Pix a round, the oldest first', async () => {
    const { repositories, spi, check } = setup();
    for (let n = 1; n <= 25; n++) {
      repositories.transfers.push(waitingPix(`pix-${String(n)}`, minutesAgo(40 - n), e2e(n)));
    }

    await expect(check.execute()).resolves.toBe(20);

    expect(spi.asked).toHaveLength(20);
    expect(spi.asked[0]).toBe(e2e(1));
  });
});
