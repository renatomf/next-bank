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
      reason: 'CUSTOMER_REQUEST',
      note: 'Cliente ligou',
      requestedBy: 'operator-1',
      requestedAt: OPENED,
      expiresAt: later(24 * 60),
      demoScope: false,
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

      expect(() => request[verb]('operator-1', later(10), null)).toThrow(SelfApprovalNotAllowed);
      expect(request.statusAt(later(10))).toBe('PENDING');
    },
  );

  it('decides once: a second decision is refused (STF-09)', () => {
    const request = opened();
    request.approve('analyst-1', later(10), null);

    expect(() => request.approve('analyst-2', later(11), null)).toThrow(RequestNotPending);
    expect(() => request.reject('analyst-2', later(11), null)).toThrow(RequestNotPending);
  });

  it('expires 24 hours after it was opened, and is no longer decided (K4)', () => {
    const request = opened();

    expect(request.statusAt(later(24 * 60 - 1))).toBe('PENDING');
    expect(request.statusAt(later(24 * 60))).toBe('EXPIRED');
    expect(() => request.approve('analyst-1', later(24 * 60), null)).toThrow(RequestNotPending);
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
    expect(() => opened().cancel('analyst-1', later(5))).toThrow(NotTheRequester);
  });

  it('refuses a request already decided or expired', () => {
    const decided = opened();
    decided.reject('analyst-1', later(5), null);

    expect(() => decided.cancel('operator-1', later(6))).toThrow(RequestNotPending);
    expect(() => opened().cancel('operator-1', later(24 * 60))).toThrow(RequestNotPending);
  });
});
