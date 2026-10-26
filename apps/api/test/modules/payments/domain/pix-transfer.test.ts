import { describe, expect, it } from 'vitest';
import {
  InvalidAmount,
  InvalidTransferState,
  LimitExceeded,
  SamePayerAndPayee,
} from '../../../../src/modules/payments/domain/errors.ts';
import {
  type CreatePixTransferInput,
  PixTransfer,
} from '../../../../src/modules/payments/domain/pix-transfer.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// Pix transfer and its state machine (domain-model.md 3.4 and 4): it is born
// awaiting authorization, expires in 10 minutes and moves only along the
// diagram. Times are server times (PIX-10); 15:00 UTC is 12:00 in São Paulo.
const NOW = new Date('2026-10-07T15:00:00.000Z');
const LATER = new Date('2026-10-07T15:01:00.000Z');
const E2E = 'E00000000202610071501a1B2c3D4e5F';

const PAYEE = {
  accountId: 'account-b',
  name: 'Marina Costa',
  documentMasked: '***.842.917-**',
  keyType: 'CPF' as const,
  keyMasked: '***.842.917-**',
};

function input(overrides: Partial<CreatePixTransferInput> = {}): CreatePixTransferInput {
  return {
    id: 'pix-1',
    payerAccountId: 'account-a',
    payee: PAYEE,
    amount: Money.of(8_000n),
    description: 'Almoço',
    now: NOW,
    ...overrides,
  };
}

function processing(): PixTransfer {
  const transfer = PixTransfer.create(input());
  transfer.startProcessing(LATER);
  return transfer;
}

describe('PixTransfer.create', () => {
  it('is born awaiting authorization, expiring in 10 minutes, with the payee snapshot', () => {
    const { state } = PixTransfer.create(input());

    expect(state).toEqual({
      id: 'pix-1',
      endToEndId: null,
      payerAccountId: 'account-a',
      payee: PAYEE,
      amount: Money.of(8_000n),
      description: 'Almoço',
      status: 'AWAITING_AUTH',
      failureReason: null,
      version: 0,
      createdAt: NOW,
      expiresAt: new Date('2026-10-07T15:10:00.000Z'),
      authorizedAt: null,
      completedAt: null,
      updatedAt: NOW,
    });
  });

  it('keeps no empty description', () => {
    expect(PixTransfer.create(input({ description: '' })).state.description).toBeNull();
    expect(PixTransfer.create(input({ description: null })).state.description).toBeNull();
  });

  it('refuses a description longer than 140 characters', () => {
    expect(() => PixTransfer.create(input({ description: 'x'.repeat(141) }))).toThrow(/140/);
  });

  it.each([0n, -1n])('refuses an amount of %i cents (InvalidAmount)', (cents) => {
    expect(() => PixTransfer.create(input({ amount: Money.of(cents) }))).toThrow(InvalidAmount);
  });

  it('accepts the minimum of one cent', () => {
    expect(PixTransfer.create(input({ amount: Money.of(1n) })).state.status).toBe('AWAITING_AUTH');
  });

  it('refuses a Pix to the payer itself (SamePayerAndPayee)', () => {
    expect(() =>
      PixTransfer.create(input({ payee: { ...PAYEE, accountId: 'account-a' } })),
    ).toThrow(SamePayerAndPayee);
  });

  it('checks the limit early, by the server clock (LimitExceeded)', () => {
    const night = new Date('2026-10-08T00:00:00.000Z');

    expect(() => PixTransfer.create(input({ amount: Money.of(100_001n), now: night }))).toThrow(
      LimitExceeded,
    );
  });
});

describe('PixTransfer state machine', () => {
  it('moves to processing on authorization, recording when', () => {
    const transfer = processing();

    expect(transfer.state).toMatchObject({
      status: 'PROCESSING',
      authorizedAt: LATER,
      updatedAt: LATER,
      version: 1,
    });
  });

  it('completes with its end-to-end id', () => {
    const transfer = processing();

    transfer.complete(E2E, LATER);

    expect(transfer.state).toMatchObject({
      status: 'COMPLETED',
      endToEndId: E2E,
      completedAt: LATER,
      version: 2,
    });
  });

  it('fails with a reason and no end-to-end id', () => {
    const transfer = processing();

    transfer.fail('INSUFFICIENT_FUNDS', LATER);

    expect(transfer.state).toMatchObject({
      status: 'FAILED',
      failureReason: 'INSUFFICIENT_FUNDS',
      endToEndId: null,
      completedAt: null,
    });
  });

  it('is cancelled only while awaiting authorization', () => {
    const transfer = PixTransfer.create(input());

    transfer.cancel(LATER);

    expect(transfer.state).toMatchObject({ status: 'CANCELLED', updatedAt: LATER, version: 1 });
    expect(() => {
      processing().cancel(LATER);
    }).toThrow(InvalidTransferState);
  });

  // PIX-08: a Pix is processed once; a second authorization finds it done.
  it.each([
    [
      'completed',
      (t: PixTransfer) => {
        t.startProcessing(LATER);
        t.complete(E2E, LATER);
      },
    ],
    [
      'failed',
      (t: PixTransfer) => {
        t.startProcessing(LATER);
        t.fail('LIMIT_EXCEEDED', LATER);
      },
    ],
    [
      'cancelled',
      (t: PixTransfer) => {
        t.cancel(LATER);
      },
    ],
  ])('refuses to authorize a %s Pix again (InvalidTransferState)', (_case, settle) => {
    const transfer = PixTransfer.create(input());
    settle(transfer);

    expect(() => {
      transfer.startProcessing(LATER);
    }).toThrow(InvalidTransferState);
    expect(() => {
      transfer.cancel(LATER);
    }).toThrow(InvalidTransferState);
  });

  // Checked before the PIN: a settled Pix never costs a PIN attempt.
  it('tells whether it still awaits authorization, without moving', () => {
    const awaiting = PixTransfer.create(input());
    const cancelled = PixTransfer.create(input());
    cancelled.cancel(LATER);

    expect(() => {
      awaiting.assertAwaitingAuthorization();
    }).not.toThrow();
    expect(awaiting.state.version).toBe(0);
    expect(() => {
      cancelled.assertAwaitingAuthorization();
    }).toThrow(InvalidTransferState);
  });

  it('completes or fails only while processing', () => {
    const awaiting = PixTransfer.create(input());

    expect(() => {
      awaiting.complete(E2E, LATER);
    }).toThrow(InvalidTransferState);
    expect(() => {
      awaiting.fail('INSUFFICIENT_FUNDS', LATER);
    }).toThrow(InvalidTransferState);
  });

  it('expires exactly 10 minutes after creation', () => {
    const transfer = PixTransfer.create(input());

    expect(transfer.isExpired(new Date('2026-10-07T15:09:59.999Z'))).toBe(false);
    expect(transfer.isExpired(new Date('2026-10-07T15:10:00.000Z'))).toBe(true);
  });

  // The use case cancels an expired Pix and answers TransferExpired (PIX-08).
  it('never starts processing once expired', () => {
    const transfer = PixTransfer.create(input());

    expect(() => {
      transfer.startProcessing(new Date('2026-10-07T15:10:00.000Z'));
    }).toThrow(/expired/);
  });

  // Checked again at authorization: the hour may have changed since creation.
  it('tells whether the amount exceeds the limit at another time', () => {
    const transfer = PixTransfer.create(input({ amount: Money.of(200_000n) }));

    expect(transfer.exceedsLimitAt(NOW)).toBe(false);
    expect(transfer.exceedsLimitAt(new Date('2026-10-07T23:00:00.000Z'))).toBe(true);
  });

  it('restores a stored transfer as it was', () => {
    const { state } = processing();

    expect(PixTransfer.restore(state).state).toEqual(state);
  });
});

// The Pix to another bank (v1.2.0 plan, task 3, P3): the payee is a key of
// another (made-up) bank, never a next bank account; its end-to-end id is
// drawn at authorization and goes with every attempt to the SPI (EXT-03).
describe('PixTransfer to another bank', () => {
  const EXTERNAL_PAYEE = {
    accountId: null,
    bank: { ispb: '99900001', name: 'Banco Aurora' },
    name: 'Clara Aurora Teixeira',
    documentMasked: '***.407.256-**',
    keyType: 'EMAIL' as const,
    keyMasked: 'cl***@example.com',
  };

  function external(): PixTransfer {
    return PixTransfer.create(input({ payee: EXTERNAL_PAYEE }));
  }

  it('is born awaiting authorization with the bank in the payee snapshot', () => {
    const transfer = external();

    expect(transfer.state).toMatchObject({ status: 'AWAITING_AUTH', payee: EXTERNAL_PAYEE });
    expect(transfer.goesToAnotherBank).toBe(true);
    expect(PixTransfer.create(input()).goesToAnotherBank).toBe(false);
  });

  it.each([
    ['both a next bank account and another bank', { ...EXTERNAL_PAYEE, accountId: 'account-b' }],
    ['neither', { ...PAYEE, accountId: null }],
  ])('refuses a payee with %s', (_case, payee) => {
    expect(() => PixTransfer.create(input({ payee }))).toThrow(/account or to another bank/);
  });

  it('waits for the SPI while processing, with the end-to-end id drawn at authorization', () => {
    const transfer = external();
    transfer.startProcessing(LATER);

    transfer.awaitSettlement(E2E);

    expect(transfer.state).toMatchObject({
      status: 'PROCESSING',
      endToEndId: E2E,
      completedAt: null,
      version: 1,
    });
  });

  it('draws its end-to-end id once', () => {
    const transfer = external();
    transfer.startProcessing(LATER);
    transfer.awaitSettlement(E2E);

    expect(() => {
      transfer.awaitSettlement('E00000000202610071501zzzzzzzzzzz');
    }).toThrow(InvalidTransferState);
  });

  it('waits for the SPI only while processing, and only when it goes to another bank', () => {
    const internal = processing();

    expect(() => {
      external().awaitSettlement(E2E);
    }).toThrow(InvalidTransferState);
    expect(() => {
      internal.awaitSettlement(E2E);
    }).toThrow(/another bank/);
  });

  // v1.2.0 plan, task 4: the SPI's answer ends the Pix to another bank.
  function waiting(): PixTransfer {
    const transfer = external();
    transfer.startProcessing(LATER);
    transfer.awaitSettlement(E2E);
    return transfer;
  }
  const ANSWERED = new Date('2026-10-07T15:03:00.000Z');

  it('completes when the SPI settles it, keeping its end-to-end id', () => {
    const transfer = waiting();

    transfer.settle(ANSWERED);

    expect(transfer.state).toMatchObject({
      status: 'COMPLETED',
      endToEndId: E2E,
      completedAt: ANSWERED,
      updatedAt: ANSWERED,
      version: 2,
    });
  });

  it('fails as refused by the payee bank, keeping its end-to-end id (W1)', () => {
    const transfer = waiting();

    transfer.rejectBySpi(ANSWERED);

    expect(transfer.state).toMatchObject({
      status: 'FAILED',
      failureReason: 'PAYEE_BANK_REJECTED',
      endToEndId: E2E,
      completedAt: null,
      version: 2,
    });
  });

  // EXT-02: a final state never changes, whatever the SPI says afterwards.
  it.each([
    [
      'settled',
      (t: PixTransfer) => {
        t.settle(ANSWERED);
      },
    ],
    [
      'refused',
      (t: PixTransfer) => {
        t.rejectBySpi(ANSWERED);
      },
    ],
  ])('takes no answer once %s', (_case, answer) => {
    const transfer = waiting();
    answer(transfer);

    expect(() => {
      transfer.settle(ANSWERED);
    }).toThrow(InvalidTransferState);
    expect(() => {
      transfer.rejectBySpi(ANSWERED);
    }).toThrow(InvalidTransferState);
  });

  it('takes the answer only of a Pix sent to another bank', () => {
    const internal = processing();
    const notSent = external();
    notSent.startProcessing(LATER);

    expect(() => {
      internal.settle(ANSWERED);
    }).toThrow(/another bank/);
    expect(() => {
      notSent.rejectBySpi(ANSWERED);
    }).toThrow(/end-to-end id/);
  });

  it('restores the payee at another bank as it was', () => {
    const { state } = external();

    expect(PixTransfer.restore(state).state).toEqual(state);
  });
});
