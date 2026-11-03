import { beforeEach, describe, expect, it } from 'vitest';
import { DecideRequest } from '../../../../src/modules/operations/application/decide-request.ts';
import type { StaffReader } from '../../../../src/modules/operations/application/ports.ts';
import { RequestReversal } from '../../../../src/modules/operations/application/request-reversal.ts';
import {
  PayeeInsufficientFunds,
  PixNotReversible,
  RequestAlreadyOpen,
  RequestNotPending,
  SelfApprovalNotAllowed,
} from '../../../../src/modules/operations/domain/errors.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FakeFingerprint, InMemoryOperationsBank } from './command-fakes.ts';
import { FixedClock, SequentialIds } from './fakes.ts';

// Reversing a Pix with two people (v1.3.0 plan, task 5; B7): an operator asks,
// someone else approves, and only then the payee gives the amount back, in a
// new ledger entry, once (STF-03, STF-09). Only a completed internal Pix is
// reversed, always for its own amount (PIX-14); a payee without the money
// leaves the request pending and moves nothing (V1).
const NOW = new Date('2026-11-02T15:00:00.000Z');
const operator: StaffReader = { memberId: 'operator-1', isDemo: false, requestId: 'req-1' };
const analyst: StaffReader = { memberId: 'analyst-1', isDemo: false, requestId: 'req-2' };
const demoOperator: StaffReader = { memberId: 'demo-op', isDemo: true, requestId: 'req-3' };

let bank: InMemoryOperationsBank;
let deps: ConstructorParameters<typeof RequestReversal>[0];
let keys = 0;
const key = () => `00000000-0000-4000-8000-${String(++keys).padStart(12, '0')}`;

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
  };
  bank.addCustomer({ id: 'carla', name: 'Carla', email: 'c@x.test', isDemo: true });
  bank.addCustomer({ id: 'ana', name: 'Ana', email: 'a@x.test', isDemo: true });
  bank.addCustomer({ id: 'visitor', name: 'Visitante', email: 'v@x.test', isDemo: false });
  const pix = (id: string, payer: string, payee: string | null, status = 'COMPLETED') => {
    bank.pix.set(id, {
      id,
      endToEndId: null,
      payerAccountId: payer,
      payeeAccountId: payee,
      amount: Money.of(8_000n),
      status,
      payee: { name: 'Ana', documentMasked: '***.444.777-**' },
    });
  };
  pix('pix-1', 'carla', 'ana');
  pix('pix-to-visitor', 'carla', 'visitor');
  pix('pix-external', 'carla', null);
  pix('pix-failed', 'carla', 'ana', 'FAILED');
});

const ask = (actor: StaffReader, transferId: string) =>
  new RequestReversal(deps).execute(actor, {
    transferId,
    reason: 'FRAUD_SUSPECTED',
    note: null,
    idempotencyKey: key(),
  });

const approve = (actor: StaffReader, requestId: string) =>
  new DecideRequest(deps).execute(actor, {
    requestId,
    decision: 'APPROVE',
    note: null,
    idempotencyKey: key(),
  });

describe('RequestReversal', () => {
  it('opens a pending request for the Pix, about its payer', async () => {
    const request = await ask(operator, 'pix-1');

    expect(request).toMatchObject({
      kind: 'REVERSE_PIX',
      status: 'PENDING',
      customer: { id: 'carla', name: 'Carla' },
      transfer: { id: 'pix-1', amount: { amount: 8_000, currency: 'BRL' }, payeeName: 'Ana' },
    });
  });

  it.each(['pix-external', 'pix-failed'])(
    'refuses %s: only a completed internal Pix',
    async (id) => {
      await expect(ask(operator, id)).rejects.toThrow(PixNotReversible);
    },
  );

  it('refuses a Pix already reversed', async () => {
    bank.reversed.add('pix-1');

    await expect(ask(operator, 'pix-1')).rejects.toThrow(PixNotReversible);
  });

  it('answers NotFound for a Pix that does not exist', async () => {
    await expect(ask(operator, 'pix-unknown')).rejects.toThrow(NotFound);
  });

  it('refuses a second open request for the same Pix', async () => {
    await ask(operator, 'pix-1');

    await expect(ask(operator, 'pix-1')).rejects.toThrow(RequestAlreadyOpen);
  });

  it("never lets the demo staff reverse a Pix that reached a visitor's account (STF-11)", async () => {
    await expect(ask(demoOperator, 'pix-to-visitor')).rejects.toThrow(NotFound);
  });
});

describe('approving a reversal', () => {
  it('reverses the Pix once, by someone other than the requester', async () => {
    const request = await ask(operator, 'pix-1');

    await expect(approve(operator, request.id)).rejects.toThrow(SelfApprovalNotAllowed);
    const decided = await approve(analyst, request.id);

    expect(decided.status).toBe('APPROVED');
    expect(bank.reversed.has('pix-1')).toBe(true);
    expect(bank.audit.map((event) => event.action)).toContain('PIX_REVERSED');
    await expect(approve(analyst, request.id)).rejects.toThrow(RequestNotPending);
  });

  it('leaves the request pending when the payee lacks the money (V1)', async () => {
    const request = await ask(operator, 'pix-1');
    bank.spendable.set('ana', 3_000n);

    await expect(approve(analyst, request.id)).rejects.toThrow(PayeeInsufficientFunds);
    expect(bank.reversed.has('pix-1')).toBe(false);
    expect(bank.requests.get(request.id)?.decision).toBeNull();
  });
});
