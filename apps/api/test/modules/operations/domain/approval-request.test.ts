import { describe, expect, it } from 'vitest';
import { ApprovalRequest } from '../../../../src/modules/operations/domain/approval-request.ts';
import {
  InvalidRequestNote,
  NotTheRequester,
  RequestNotPending,
  SelfApprovalNotAllowed,
} from '../../../../src/modules/operations/domain/errors.ts';

// A request that needs two people (v1.3.0 plan, task 4; B6, K3, K4): one
// opens it, another approves or rejects it, and only who opened it may
// cancel it. It expires 24 hours after it was opened, with no job: the
// expiry is read from the clock (STF-03, STF-09).
const OPENED = new Date('2026-11-02T12:00:00.000Z');
const later = (minutes: number) => new Date(OPENED.getTime() + minutes * 60_000);

function opened(note: string | null = null) {
  return ApprovalRequest.open({
    id: 'req-1',
    kind: 'UNBLOCK_ACCOUNT',
    customerId: 'customer-1',
    transferId: null,
    reason: 'CUSTOMER_REQUEST',
    note,
    requestedBy: 'operator-1',
    demoScope: false,
    now: OPENED,
  });
}

describe('ApprovalRequest.open', () => {
  it('opens pending, expiring 24 hours later', () => {
    const request = opened('Cliente ligou');

    expect(request.state).toEqual({
      id: 'req-1',
      kind: 'UNBLOCK_ACCOUNT',
      customerId: 'customer-1',
      transferId: null,
      reason: 'CUSTOMER_REQUEST',
      note: 'Cliente ligou',
      requestedBy: 'operator-1',
      requestedAt: OPENED,
      expiresAt: later(24 * 60),
      demoScope: false,
      exceptionId: null,
      resolution: null,
      decision: null,
    });
    expect(request.statusAt(OPENED)).toBe('PENDING');
  });

  it('keeps a note trimmed, and none when blank', () => {
    expect(opened('  Cliente ligou  ').state.note).toBe('Cliente ligou');
    expect(opened('   ').state.note).toBeNull();
  });

  it('refuses a note over 500 characters', () => {
    expect(() => opened('x'.repeat(501))).toThrow(InvalidRequestNote);
  });
});

describe('deciding', () => {
  it('lets another person approve', () => {
    const request = opened();

    request.approve('analyst-1', later(10), 'Conferido');

    expect(request.statusAt(later(11))).toBe('APPROVED');
    expect(request.state.decision).toEqual({
      decision: 'APPROVED',
      decidedBy: 'analyst-1',
      decidedAt: later(10),
      note: 'Conferido',
    });
  });

  it('lets another person reject', () => {
    const request = opened();

    request.reject('analyst-1', later(10), null);

    expect(request.statusAt(later(11))).toBe('REJECTED');
  });

  it.each(['approve', 'reject'] as const)(
    'never lets the requester %s their own request (STF-03)',
    (verb) => {
      const request = opened();

      expect(() => {
        request[verb]('operator-1', later(10), null);
      }).toThrow(SelfApprovalNotAllowed);
      expect(request.statusAt(later(10))).toBe('PENDING');
    },
  );

  it('decides once: a second decision is refused (STF-09)', () => {
    const request = opened();
    request.approve('analyst-1', later(10), null);

    expect(() => {
      request.approve('analyst-2', later(11), null);
    }).toThrow(RequestNotPending);
    expect(() => {
      request.reject('analyst-2', later(11), null);
    }).toThrow(RequestNotPending);
  });

  it('expires 24 hours after it was opened, and is no longer decided (K4)', () => {
    const request = opened();

    expect(request.statusAt(later(24 * 60 - 1))).toBe('PENDING');
    expect(request.statusAt(later(24 * 60))).toBe('EXPIRED');
    expect(() => {
      request.approve('analyst-1', later(24 * 60), null);
    }).toThrow(RequestNotPending);
  });
});

describe('cancelling', () => {
  it('lets the requester cancel', () => {
    const request = opened();

    request.cancel('operator-1', later(5));

    expect(request.statusAt(later(6))).toBe('CANCELLED');
    expect(request.state.decision?.decidedBy).toBe('operator-1');
  });

  it('refuses anyone else', () => {
    expect(() => {
      opened().cancel('analyst-1', later(5));
    }).toThrow(NotTheRequester);
  });

  it('refuses a request already decided or expired', () => {
    const decided = opened();
    decided.reject('analyst-1', later(5), null);

    expect(() => {
      decided.cancel('operator-1', later(6));
    }).toThrow(RequestNotPending);
    expect(() => {
      opened().cancel('operator-1', later(24 * 60));
    }).toThrow(RequestNotPending);
  });
});

// v1.3.0 plan, task 5: a reversal names the Pix it reverses; an unblock names
// none. The amount is never the request's: it is read from the Pix (PIX-14).
describe('a reversal request', () => {
  const reversal = (transferId: string | null) =>
    ApprovalRequest.open({
      id: 'req-2',
      kind: 'REVERSE_PIX',
      customerId: 'customer-1',
      transferId,
      reason: 'FRAUD_SUSPECTED',
      note: null,
      requestedBy: 'operator-1',
      demoScope: false,
      now: OPENED,
    });

  it('opens with the Pix it reverses', () => {
    expect(reversal('pix-1').state).toMatchObject({ kind: 'REVERSE_PIX', transferId: 'pix-1' });
  });

  it('refuses a reversal without its Pix, and an unblock with one', () => {
    expect(() => reversal(null)).toThrow(/Pix/);
    expect(() =>
      ApprovalRequest.open({
        id: 'req-3',
        kind: 'UNBLOCK_ACCOUNT',
        customerId: 'customer-1',
        transferId: 'pix-1',
        reason: 'OTHER',
        note: null,
        requestedBy: 'operator-1',
        demoScope: false,
        now: OPENED,
      }),
    ).toThrow(/Pix/);
  });
});

// v1.3.0 plan, task 6: settling or refunding a Pix left waiting names the
// exception and how; nothing else names one.
describe('a request to resolve an exception', () => {
  const resolution = (kind: 'RESOLVE_EXCEPTION' | 'UNBLOCK_ACCOUNT', withException: boolean) =>
    ApprovalRequest.open({
      id: 'req-4',
      kind,
      customerId: 'customer-1',
      transferId: null,
      ...(withException ? { exception: { id: 'exception-1', resolution: 'REFUND' as const } } : {}),
      reason: 'OTHER',
      note: null,
      requestedBy: 'operator-1',
      demoScope: false,
      now: OPENED,
    });

  it('opens with the exception and how to resolve it', () => {
    expect(resolution('RESOLVE_EXCEPTION', true).state).toMatchObject({
      kind: 'RESOLVE_EXCEPTION',
      exceptionId: 'exception-1',
      resolution: 'REFUND',
      transferId: null,
    });
  });

  it('refuses one without its exception, and another kind with one', () => {
    expect(() => resolution('RESOLVE_EXCEPTION', false)).toThrow(/exception/);
    expect(() => resolution('UNBLOCK_ACCOUNT', true)).toThrow(/exception/);
  });
});
