import { beforeEach, describe, expect, it } from 'vitest';
import { ReadAuditTrail } from '../../../../src/modules/operations/application/audit-trail.ts';
import type {
  AuditRecord,
  StaffReader,
} from '../../../../src/modules/operations/application/ports.ts';
import { RequestUnblock } from '../../../../src/modules/operations/application/request-unblock.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FakeFingerprint, InMemoryOperationsBank } from './command-fakes.ts';
import { FixedClock, SequentialIds } from './fakes.ts';

// The audit trail as the staff reads it (v1.3.0 plan, task 8): who did what
// and when, by customer, by staff member or by request, the newest first. Each
// filter checks the reader's scope first (STF-11, STF-16), and reading a
// customer's trail is itself recorded (STF-07). Only the staff is named (H4).
const NOW = new Date('2026-11-03T15:00:00.000Z');
const analyst: StaffReader = { memberId: 'analyst-1', isDemo: false, requestId: 'req-1' };
const demoAnalyst: StaffReader = { memberId: 'demo-an', isDemo: true, requestId: 'req-2' };

let bank: InMemoryOperationsBank;
let deps: ConstructorParameters<typeof ReadAuditTrail>[0];
let minutes = 0;

function event(overrides: Partial<AuditRecord>): AuditRecord {
  minutes += 1;
  return {
    id: `event-${String(minutes).padStart(3, '0')}`,
    occurredAt: new Date(Date.UTC(2026, 10, 3, 12, minutes)),
    actorType: 'STAFF',
    actorId: 'operator-1',
    action: 'REQUEST_CREATED',
    subjectType: 'APPROVAL_REQUEST',
    subjectId: 'request-x',
    requestId: null,
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  bank = new InMemoryOperationsBank();
  deps = {
    unitOfWork: bank,
    customers: bank,
    accounts: bank,
    audit: bank,
    clock: new FixedClock(NOW),
    ids: new SequentialIds(),
    accountStatus: bank,
    access: bank,
    staffNames: bank,
    repositories: bank.repositories,
    fingerprint: new FakeFingerprint(),
    transfers: bank,
    reversals: bank,
    exceptions: bank,
    stalePix: bank,
    auditReader: bank,
  };
  bank.addCustomer({ id: 'carla', name: 'Carla', email: 'c@x.test', isDemo: true });
  bank.addCustomer({ id: 'visitor', name: 'Visitante', email: 'v@x.test', isDemo: false });
  bank.staffMembers.set('operator-1', { name: 'Olívia', isDemo: true });
  bank.staffMembers.set('operator-real', { name: 'Lia', isDemo: false });
  bank.staffNames.set('operator-1', 'Olívia');
  bank.staffNames.set('operator-real', 'Lia');
});

const read = (actor: StaffReader, query: Parameters<ReadAuditTrail['execute']>[1]) =>
  new ReadAuditTrail(deps).execute(actor, query, null);

describe('the trail of a customer', () => {
  it('shows what the customer did and what happened to them or their account, newest first', async () => {
    bank.auditEvents.push(
      event({
        actorType: 'USER',
        actorId: 'carla',
        action: 'LOGIN_SUCCEEDED',
        subjectType: 'USER',
        subjectId: 'carla',
      }),
      event({ action: 'ACCOUNT_BLOCKED', subjectType: 'ACCOUNT', subjectId: 'account-of-carla' }),
      event({
        actorType: 'USER',
        actorId: 'visitor',
        action: 'LOGIN_SUCCEEDED',
        subjectType: 'USER',
        subjectId: 'visitor',
      }),
    );

    const page = await read(analyst, { by: 'CUSTOMER', customerId: 'carla' });

    expect(page.items.map((item) => item.action)).toEqual(['ACCOUNT_BLOCKED', 'LOGIN_SUCCEEDED']);
    expect(page.items[0]).toMatchObject({
      actor: { type: 'STAFF', id: 'operator-1', name: 'Olívia' },
      subject: { type: 'ACCOUNT', id: 'account-of-carla' },
    });
    expect(page.items[1]?.actor).toEqual({ type: 'USER', id: 'carla', name: null });
  });

  it("records that the reader saw the customer's trail (STF-07, H3)", async () => {
    await read(analyst, { by: 'CUSTOMER', customerId: 'carla' });

    expect(bank.audit.at(-1)).toMatchObject({
      action: 'SENSITIVE_DATA_ACCESSED',
      actorId: 'analyst-1',
      subjectType: 'USER',
      subjectId: 'carla',
      metadata: { view: 'AUDIT' },
    });
  });

  it("answers NotFound for an unknown customer, and to the demo staff for a visitor's (STF-11)", async () => {
    await expect(read(analyst, { by: 'CUSTOMER', customerId: 'nobody' })).rejects.toThrow(NotFound);
    await expect(read(demoAnalyst, { by: 'CUSTOMER', customerId: 'visitor' })).rejects.toThrow(
      NotFound,
    );
    expect(bank.audit).toEqual([]);
  });
});

describe('the trail of a staff member', () => {
  it('shows what the member did, named', async () => {
    bank.auditEvents.push(event({}), event({ actorId: 'operator-real' }));

    const page = await read(analyst, { by: 'MEMBER', memberId: 'operator-1' });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.actor.name).toBe('Olívia');
  });

  it('keeps the demo staff to the demo members (STF-11)', async () => {
    await expect(read(demoAnalyst, { by: 'MEMBER', memberId: 'operator-real' })).rejects.toThrow(
      NotFound,
    );
    await expect(read(analyst, { by: 'MEMBER', memberId: 'nobody' })).rejects.toThrow(NotFound);
    await expect(
      read(demoAnalyst, { by: 'MEMBER', memberId: 'operator-1' }),
    ).resolves.toBeDefined();
  });
});

describe('the trail of a request', () => {
  async function opened(customerId: string): Promise<string> {
    bank.statuses.set(customerId, 'BLOCKED');
    const request = await new RequestUnblock(deps).execute(
      { memberId: 'operator-1', isDemo: false, requestId: 'req-9' },
      { customerId, reason: 'OTHER', note: null, idempotencyKey: `key-${customerId}` },
    );
    return request.id;
  }

  it('shows the request and what cites it (H5)', async () => {
    const requestId = await opened('carla');
    bank.auditEvents.push(
      event({ subjectId: requestId }),
      event({
        action: 'PIX_FAILED',
        subjectType: 'PIX_TRANSFER',
        subjectId: 'pix-1',
        metadata: { approvalRequestId: requestId },
      }),
      event({ subjectId: 'another-request' }),
    );

    const page = await read(analyst, { by: 'REQUEST', requestId });

    expect(page.items.map((item) => item.action)).toEqual(['PIX_FAILED', 'REQUEST_CREATED']);
  });

  it('keeps the demo staff out of a request outside the demo, and answers NotFound for none', async () => {
    const requestId = await opened('visitor');

    await expect(read(demoAnalyst, { by: 'REQUEST', requestId })).rejects.toThrow(NotFound);
    await expect(read(analyst, { by: 'REQUEST', requestId: 'nothing' })).rejects.toThrow(NotFound);
  });
});

describe('a page of the trail', () => {
  it('ends with the position of the next page, 20 at a time', async () => {
    for (let i = 0; i < 21; i += 1) bank.auditEvents.push(event({}));

    const first = await read(analyst, { by: 'MEMBER', memberId: 'operator-1' });
    const second = await new ReadAuditTrail(deps).execute(
      analyst,
      { by: 'MEMBER', memberId: 'operator-1' },
      first.next,
    );

    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(1);
    expect(second.next).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(21);
  });
});
