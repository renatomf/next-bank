import { describe, expect, it } from 'vitest';
import { ApplySpiOutcome } from '../../../../src/modules/payments/application/apply-spi-outcome.ts';
import { PixTransfer } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeUnitOfWork, twoCustomers } from './fakes.ts';

// The SPI's answer to a Pix to another bank (v1.2.0 plan, task 4), by
// webhook or by the status check, one use case: settled, the money moves
// from the clearing account to the settlement one; refused, it comes back to
// the payer (D6). Each webhook event is taken once (EXT-02), and a final
// state never changes.
const CREATED = new Date('2026-10-26T15:00:00.000Z');
const AUTHORIZED = new Date('2026-10-26T15:01:00.000Z');
const NOW = new Date('2026-10-26T15:03:00.000Z');
const E2E = 'E00000000202610261501a1B2c3D4e5F';
const EVENT = '0f8e2c1a-5b7d-4e39-9a64-3c2d1b0a9f87';

function setup() {
  const world = twoCustomers();
  const transfer = PixTransfer.create({
    id: 'pix-2',
    payerAccountId: 'account-a',
    payee: {
      accountId: null,
      bank: { ispb: '99900001', name: 'Banco Aurora' },
      name: 'Clara Aurora Teixeira',
      documentMasked: '***.407.256-**',
      keyType: 'EMAIL',
      keyMasked: 'cl***@example.com',
    },
    amount: Money.of(8_000n),
    description: null,
    now: CREATED,
  });
  transfer.startProcessing(AUTHORIZED);
  transfer.awaitSettlement(E2E);
  world.repositories.transfers.push(transfer.state);
  world.ledger.balances.set('account-a', Money.of(2_000n));
  const apply = new ApplySpiOutcome({
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    ledger: world.ledger,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
  });
  return { ...world, apply };
}

const webhook = (status: 'SETTLED' | 'REJECTED', eventId = EVENT) => ({
  eventId,
  endToEndId: E2E,
  status,
});

describe('ApplySpiOutcome', () => {
  it('completes a settled Pix and moves its money to the settlement account', async () => {
    const { repositories, ledger, apply } = setup();

    await expect(apply.execute(webhook('SETTLED'))).resolves.toBe('APPLIED');

    expect(repositories.transfers[0]).toMatchObject({ status: 'COMPLETED', completedAt: NOW });
    expect(ledger.settled).toEqual([{ transferId: 'pix-2', amount: Money.of(8_000n) }]);
    expect(ledger.refunded).toEqual([]);
    expect(repositories.inbox.get(EVENT)).toBe('APPLIED');
  });

  it('fails a refused Pix and gives the payer the money back (D6)', async () => {
    const { repositories, ledger, apply } = setup();

    await expect(apply.execute(webhook('REJECTED'))).resolves.toBe('APPLIED');

    expect(repositories.transfers[0]).toMatchObject({
      status: 'FAILED',
      failureReason: 'PAYEE_BANK_REJECTED',
      endToEndId: E2E,
    });
    expect(ledger.refunded).toEqual([
      {
        transferId: 'pix-2',
        payerAccountId: 'account-a',
        amount: Money.of(8_000n),
        payee: { name: 'Clara Aurora Teixeira', documentMasked: '***.407.256-**' },
      },
    ]);
    expect(ledger.balances.get('account-a')).toEqual(Money.of(10_000n));
  });

  it('records the end in the audit trail as the system, with the event (PIX-09)', async () => {
    const { repositories, apply } = setup();

    await apply.execute(webhook('SETTLED'));

    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        actorType: 'SYSTEM',
        actorId: null,
        action: 'PIX_COMPLETED',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'pix-2',
        metadata: { endToEndId: E2E, eventId: EVENT },
      }),
    ]);
  });

  // EXT-02: a webhook delivered again changes nothing.
  it('takes the same event once', async () => {
    const { ledger, apply } = setup();
    await apply.execute(webhook('SETTLED'));

    await expect(apply.execute(webhook('SETTLED'))).resolves.toBe('DUPLICATE');

    expect(ledger.settled).toHaveLength(1);
  });

  it('ignores another answer once the Pix is final, and records it', async () => {
    const { repositories, ledger, apply } = setup();
    await apply.execute(webhook('SETTLED'));
    const late = '7c3b2a19-0d8e-4f6a-b5c4-e3d2c1b0a998';

    await expect(apply.execute(webhook('REJECTED', late))).resolves.toBe('IGNORED');

    expect(repositories.transfers[0]?.status).toBe('COMPLETED');
    expect(ledger.refunded).toEqual([]);
    expect(repositories.inbox.get(late)).toBe('IGNORED');
  });

  it('ignores and records an event for an end-to-end id it does not know', async () => {
    const { repositories, apply } = setup();

    await expect(
      apply.execute({ ...webhook('SETTLED'), endToEndId: 'E00000000202610261501zzzzzzzzzzz' }),
    ).resolves.toBe('IGNORED');

    expect(repositories.inbox.get(EVENT)).toBe('IGNORED');
  });

  // EXT-03: the status check brings the same answer, without an event id.
  it('applies the answer of the status check, which has no event', async () => {
    const { repositories, ledger, apply } = setup();

    await expect(
      apply.execute({ eventId: null, endToEndId: E2E, status: 'SETTLED' }),
    ).resolves.toBe('APPLIED');

    expect(ledger.settled).toHaveLength(1);
    expect(repositories.inbox.size).toBe(0);
    expect(repositories.auditEvents[0]?.metadata).toEqual({ endToEndId: E2E });
  });
});
