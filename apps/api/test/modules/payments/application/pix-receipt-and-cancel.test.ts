import { describe, expect, it } from 'vitest';
import { CancelPixTransfer } from '../../../../src/modules/payments/application/cancel-pix-transfer.ts';
import { GetPixTransfer } from '../../../../src/modules/payments/application/get-pix-transfer.ts';
import { InvalidTransferState } from '../../../../src/modules/payments/domain/errors.ts';
import { PixTransfer } from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FixedClock, SequentialIds } from '../../identity/application/fakes.ts';
import { FakeUnitOfWork, twoCustomers } from './fakes.ts';

// The receipt and the cancel (domain-model.md 4 and 11, screens 8 and 10):
// only the payer ever reaches a Pix; anyone else gets NotFound (PIX-01).
const CREATED = new Date('2026-10-08T15:00:00.000Z');
const LATER = new Date('2026-10-08T15:02:00.000Z');

function setup() {
  const world = twoCustomers();
  world.accounts.accounts.set('account-c', {
    id: 'account-c',
    holderUserId: 'user-c',
    status: 'ACTIVE',
  });
  const transfer = PixTransfer.create({
    id: 'pix-1',
    payerAccountId: 'account-a',
    payee: {
      accountId: 'account-b',
      name: 'Marina Costa',
      documentMasked: '***.456.789-**',
      keyType: 'CPF',
      keyMasked: '***.456.789-**',
    },
    amount: Money.of(8_000n),
    description: null,
    now: CREATED,
  });
  world.repositories.transfers.push(transfer.state);
  const deps = {
    unitOfWork: new FakeUnitOfWork(),
    repositories: world.repositories,
    accounts: world.accounts,
    clock: new FixedClock(LATER),
    ids: new SequentialIds(),
  };
  return { ...world, get: new GetPixTransfer(deps), cancel: new CancelPixTransfer(deps) };
}

const asPayer = {
  userId: 'user-a',
  sessionId: 'session-a',
  transferId: 'pix-1',
  requestId: 'req-1',
};

describe('GetPixTransfer', () => {
  it('shows the payer their Pix, as the receipt does', async () => {
    const { get } = setup();

    await expect(get.execute(asPayer)).resolves.toMatchObject({
      id: 'pix-1',
      status: 'AWAITING_AUTH',
      amount: { amount: 8_000, currency: 'BRL' },
    });
  });

  it('answers NotFound to anyone else, the payee included (PIX-01)', async () => {
    const { get } = setup();

    await expect(get.execute({ ...asPayer, userId: 'user-b' })).rejects.toThrow(NotFound);
    await expect(get.execute({ ...asPayer, userId: 'user-c' })).rejects.toThrow(NotFound);
  });

  it('answers NotFound to a Pix that does not exist', async () => {
    const { get } = setup();

    await expect(get.execute({ ...asPayer, transferId: 'pix-404' })).rejects.toThrow(NotFound);
  });
});

describe('CancelPixTransfer', () => {
  it('cancels a Pix awaiting the PIN and records PIX_CANCELLED', async () => {
    const { repositories, cancel } = setup();

    const view = await cancel.execute(asPayer);

    expect(view.status).toBe('CANCELLED');
    expect(repositories.transfers[0]).toMatchObject({ status: 'CANCELLED', updatedAt: LATER });
    expect(repositories.auditEvents).toEqual([
      expect.objectContaining({
        action: 'PIX_CANCELLED',
        actorId: 'user-a',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'pix-1',
        requestId: 'req-1',
        metadata: { sessionId: 'session-a', reason: 'CUSTOMER' },
      }),
    ]);
  });

  it('refuses to cancel twice (InvalidTransferState, PIX-08)', async () => {
    const { cancel } = setup();
    await cancel.execute(asPayer);

    await expect(cancel.execute(asPayer)).rejects.toThrow(InvalidTransferState);
  });

  it("never cancels someone else's Pix (NotFound, PIX-01)", async () => {
    const { repositories, cancel } = setup();

    await expect(cancel.execute({ ...asPayer, userId: 'user-c' })).rejects.toThrow(NotFound);
    expect(repositories.transfers[0]?.status).toBe('AWAITING_AUTH');
  });
});
