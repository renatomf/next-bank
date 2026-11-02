import { beforeEach, describe, expect, it } from 'vitest';
import { BlockAccount } from '../../../../src/modules/operations/application/block-account.ts';
import { CancelRequest } from '../../../../src/modules/operations/application/cancel-request.ts';
import { DecideRequest } from '../../../../src/modules/operations/application/decide-request.ts';
import type { StaffReader } from '../../../../src/modules/operations/application/ports.ts';
import { RequestUnblock } from '../../../../src/modules/operations/application/request-unblock.ts';
import {
  AccountAlreadyBlocked,
  AccountNotBlocked,
  DemoCustomerProtected,
  NotTheRequester,
  RequestAlreadyOpen,
  RequestNotPending,
  SelfApprovalNotAllowed,
} from '../../../../src/modules/operations/domain/errors.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FakeFingerprint, InMemoryOperationsBank } from './command-fakes.ts';
import { FixedClock, SequentialIds } from './fakes.ts';

// Blocking and unblocking a customer's account (v1.3.0 plan, task 4): the
// block is immediate, by one person, and shuts the customer out (K1); the
// unblock is a request one operator opens and another person decides (B6,
// K3, STF-03). Every command is idempotent (STF-09) and stays inside the
// demo scope (STF-11), never touching the protected customers (K5, STF-13).
const NOW = new Date('2026-11-02T15:00:00.000Z');
const operator: StaffReader = { memberId: 'operator-1', isDemo: false, requestId: 'req-1' };
const analyst: StaffReader = { memberId: 'analyst-1', isDemo: false, requestId: 'req-2' };
const demoOperator: StaffReader = { memberId: 'demo-op', isDemo: true, requestId: 'req-3' };

let bank: InMemoryOperationsBank;
let clock: FixedClock;
let deps: ConstructorParameters<typeof BlockAccount>[0];
let keys = 0;
const key = () => `00000000-0000-4000-8000-${String(++keys).padStart(12, '0')}`;

beforeEach(() => {
  bank = new InMemoryOperationsBank();
  clock = new FixedClock(NOW);
  deps = {
    unitOfWork: bank,
    customers: bank,
    accounts: bank,
    audit: bank,
    clock,
    ids: new SequentialIds(),
    accountStatus: bank,
    access: bank,
    staffNames: bank,
    repositories: bank.repositories,
    fingerprint: new FakeFingerprint(),
  };
  bank.addCustomer({ id: 'carla', name: 'Carla', email: 'carla@x.test', isDemo: true });
  bank.addCustomer({
    id: 'ana',
    name: 'Ana',
    email: 'ana@x.test',
    isDemo: true,
    demoProtected: true,
  });
  bank.addCustomer({ id: 'visitor', name: 'Visitante', email: 'v@x.test', isDemo: false });
  bank.staffNames.set('operator-1', 'Olívia').set('analyst-1', 'Diogo');
});

const block = (actor: StaffReader, customerId: string, idempotencyKey = key()) =>
  new BlockAccount(deps).execute(actor, { customerId, reason: 'FRAUD_SUSPECTED', idempotencyKey });

const requestUnblock = (actor: StaffReader, customerId: string) =>
  new RequestUnblock(deps).execute(actor, {
    customerId,
    reason: 'CUSTOMER_REQUEST',
    note: 'Cliente confirmou a identidade',
    idempotencyKey: key(),
  });

const decide = (actor: StaffReader, requestId: string, decision: 'APPROVE' | 'REJECT') =>
  new DecideRequest(deps).execute(actor, {
    requestId,
    decision,
    note: null,
    idempotencyKey: key(),
  });

describe('BlockAccount', () => {
  it('blocks the account and shuts the customer out, in one go (K1)', async () => {
    await block(operator, 'carla');

    expect(bank.statuses.get('carla')).toBe('BLOCKED');
    expect(bank.lockedOut.has('carla')).toBe(true);
  });

  it('refuses a second block', async () => {
    await block(operator, 'carla');

    await expect(block(analyst, 'carla')).rejects.toThrow(AccountAlreadyBlocked);
  });

  it('answers the same request once: a repeated key blocks once (STF-09)', async () => {
    const same = key();
    await block(operator, 'carla', same);

    await expect(block(operator, 'carla', same)).resolves.toBeUndefined();
  });

  it("never reaches a visitor's account from the demo staff (STF-11)", async () => {
    await expect(block(demoOperator, 'visitor')).rejects.toThrow(NotFound);
    expect(bank.statuses.get('visitor')).toBeUndefined();
  });

  it('never lets the demo staff block a protected customer (K5, STF-13)', async () => {
    await expect(block(demoOperator, 'ana')).rejects.toThrow(DemoCustomerProtected);
    expect(bank.lockedOut.has('ana')).toBe(false);
  });

  it('lets the demo staff block the demo customer of the backoffice', async () => {
    await block(demoOperator, 'carla');

    expect(bank.statuses.get('carla')).toBe('BLOCKED');
  });
});

describe('RequestUnblock', () => {
  it('opens a pending request for a blocked account, audited', async () => {
    await block(operator, 'carla');

    const request = await requestUnblock(operator, 'carla');

    expect(request).toMatchObject({
      kind: 'UNBLOCK_ACCOUNT',
      status: 'PENDING',
      customer: { id: 'carla', name: 'Carla' },
      requestedBy: { id: 'operator-1', name: 'Olívia' },
      note: 'Cliente confirmou a identidade',
      decision: null,
    });
    expect(bank.audit.map((event) => event.action)).toContain('REQUEST_CREATED');
  });

  it('refuses an account that is not blocked', async () => {
    await expect(requestUnblock(operator, 'carla')).rejects.toThrow(AccountNotBlocked);
  });

  it('refuses a second open request for the same account', async () => {
    await block(operator, 'carla');
    await requestUnblock(operator, 'carla');

    await expect(requestUnblock(operator, 'carla')).rejects.toThrow(RequestAlreadyOpen);
  });

  it('opens a new one once the first expired (K4)', async () => {
    await block(operator, 'carla');
    await requestUnblock(operator, 'carla');
    clock.current = new Date(NOW.getTime() + 24 * 60 * 60_000);

    await expect(requestUnblock(operator, 'carla')).resolves.toMatchObject({ status: 'PENDING' });
  });
});

describe('DecideRequest', () => {
  async function openRequest() {
    await block(operator, 'carla');
    return requestUnblock(operator, 'carla');
  }

  it('approved by another person, unblocks the account and lets the customer back in', async () => {
    const request = await openRequest();

    const decided = await decide(analyst, request.id, 'APPROVE');

    expect(decided).toMatchObject({
      status: 'APPROVED',
      decision: { decision: 'APPROVED', decidedBy: { id: 'analyst-1', name: 'Diogo' } },
    });
    expect(bank.statuses.get('carla')).toBe('ACTIVE');
    expect(bank.lockedOut.has('carla')).toBe(false);
  });

  it('rejected, leaves the account blocked', async () => {
    const request = await openRequest();

    await decide(analyst, request.id, 'REJECT');

    expect(bank.statuses.get('carla')).toBe('BLOCKED');
    expect(bank.lockedOut.has('carla')).toBe(true);
  });

  it('never lets the requester approve their own request (STF-03)', async () => {
    const request = await openRequest();

    await expect(decide(operator, request.id, 'APPROVE')).rejects.toThrow(SelfApprovalNotAllowed);
    expect(bank.statuses.get('carla')).toBe('BLOCKED');
  });

  it('decides once (STF-09)', async () => {
    const request = await openRequest();
    await decide(analyst, request.id, 'APPROVE');

    await expect(decide(analyst, request.id, 'REJECT')).rejects.toThrow(RequestNotPending);
  });

  it('refuses an expired request (K4)', async () => {
    const request = await openRequest();
    clock.current = new Date(NOW.getTime() + 24 * 60 * 60_000);

    await expect(decide(analyst, request.id, 'APPROVE')).rejects.toThrow(RequestNotPending);
  });

  it("answers NotFound for a request outside the demo staff's scope (STF-11)", async () => {
    await block(operator, 'visitor');
    const request = await requestUnblock(operator, 'visitor');

    await expect(
      decide({ ...analyst, memberId: 'demo-an', isDemo: true }, request.id, 'APPROVE'),
    ).rejects.toThrow(NotFound);
  });
});

describe('CancelRequest', () => {
  it('lets the requester cancel, and no one else', async () => {
    await block(operator, 'carla');
    const request = await requestUnblock(operator, 'carla');
    const cancel = (actor: StaffReader) =>
      new CancelRequest(deps).execute(actor, { requestId: request.id, idempotencyKey: key() });

    await expect(cancel(analyst)).rejects.toThrow(NotTheRequester);
    await expect(cancel(operator)).resolves.toMatchObject({ status: 'CANCELLED' });
  });
});
