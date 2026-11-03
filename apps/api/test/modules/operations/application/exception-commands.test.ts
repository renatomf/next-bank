import { beforeEach, describe, expect, it } from 'vitest';
import { DecideRequest } from '../../../../src/modules/operations/application/decide-request.ts';
import {
  ExplainException,
  GetException,
  ListExceptions,
  RequestResolution,
} from '../../../../src/modules/operations/application/exceptions.ts';
import type { StaffReader } from '../../../../src/modules/operations/application/ports.ts';
import {
  ExceptionNotOpen,
  ExceptionNotSettleable,
  PixNoLongerProcessing,
  RequestNotPending,
  SelfApprovalNotAllowed,
} from '../../../../src/modules/operations/domain/errors.ts';
import type { ExceptionKind } from '../../../../src/modules/operations/domain/reconciliation-exception.ts';
import { Money } from '../../../../src/shared/domain/money.ts';
import { NotFound } from '../../../../src/shared/domain/not-found.ts';
import { FakeFingerprint, InMemoryOperationsBank } from './command-fakes.ts';
import { FixedClock, SequentialIds } from './fakes.ts';

// The reconciliation's exceptions, resolved by the staff (v1.3.0 plan, task
// 6; ADR 0018, D7): a Pix left waiting for the SPI is settled or refunded by
// an operator's request and someone else's approval (X1, X3), only while it
// still waits (X4, REC-01); any exception is explained by an analyst, moving
// no money (X2). The demo staff sees the demo customers' Pix and the clearing
// balance, never a visitor's Pix (X5, STF-11).
const NOW = new Date('2026-11-03T15:00:00.000Z');
const operator: StaffReader = { memberId: 'operator-1', isDemo: false, requestId: 'req-1' };
const analyst: StaffReader = { memberId: 'analyst-1', isDemo: false, requestId: 'req-2' };
const demoOperator: StaffReader = { memberId: 'demo-op', isDemo: true, requestId: 'req-3' };
const demoAnalyst: StaffReader = { memberId: 'demo-an', isDemo: true, requestId: 'req-4' };

let bank: InMemoryOperationsBank;
let deps: ConstructorParameters<typeof RequestResolution>[0];
let keys = 0;
const key = () => `00000000-0000-4000-8000-${String(++keys).padStart(12, '0')}`;
let minutes = 0;

/** An exception found by the reconciliation, each one a minute after the last. */
function found(id: string, kind: ExceptionKind, endToEndId: string | null) {
  bank.exceptions.set(id, {
    id,
    runDate: '2026-11-02',
    kind,
    endToEndId,
    expected: kind === 'CLEARING_MISMATCH' ? Money.of(10_000n) : null,
    actual: kind === 'CLEARING_MISMATCH' ? Money.of(9_000n) : null,
    detectedAt: new Date(Date.UTC(2026, 10, 3, 6, 30 + ++minutes)),
    resolution: null,
  });
}

/** A Pix to another bank, still waiting for the SPI. */
function waiting(id: string, payer: string, endToEndId: string) {
  bank.pix.set(id, {
    id,
    endToEndId,
    payerAccountId: payer,
    payeeAccountId: null,
    amount: Money.of(8_000n),
    status: 'PROCESSING',
    payee: { name: 'Maria Aurora', documentMasked: '***.111.222-**' },
  });
  bank.waiting.add(endToEndId);
}

/** The SPI answers the Pix on its own: it is no longer waiting. */
function spiAnswered(pixId: string, endToEndId: string) {
  const pix = bank.pix.get(pixId);
  if (pix) bank.pix.set(pixId, { ...pix, status: 'COMPLETED' });
  bank.waiting.delete(endToEndId);
}

const E2E = {
  carla: 'E00000000202611021200carlacarlax',
  visitor: 'E00000000202611021200visitorvisi',
  elsewhere: 'E00000000202611021200elsewherexx',
};

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
  bank.addCustomer({ id: 'visitor', name: 'Visitante', email: 'v@x.test', isDemo: false });
  bank.staffNames.set('analyst-1', 'Diogo');
  waiting('pix-carla', 'carla', E2E.carla);
  waiting('pix-visitor', 'visitor', E2E.visitor);
  found('stale-carla', 'STALE_PROCESSING', E2E.carla);
  found('stale-visitor', 'STALE_PROCESSING', E2E.visitor);
  found('missing-at-spi', 'MISSING_AT_SPI', E2E.carla);
  found('missing-here', 'MISSING_HERE', E2E.elsewhere);
  found('clearing', 'CLEARING_MISMATCH', null);
});

const ask = (actor: StaffReader, exceptionId: string, resolution: 'SETTLE' | 'REFUND' = 'REFUND') =>
  new RequestResolution(deps).execute(actor, {
    exceptionId,
    resolution,
    reason: 'OTHER',
    note: 'Conferido no SPI',
    idempotencyKey: key(),
  });

const approve = (actor: StaffReader, requestId: string) =>
  new DecideRequest(deps).execute(actor, {
    requestId,
    decision: 'APPROVE',
    note: null,
    idempotencyKey: key(),
  });

const explain = (
  actor: StaffReader,
  exceptionId: string,
  explanation = 'Conferido no SPI: devolvido.',
) => new ExplainException(deps).execute(actor, { exceptionId, explanation, idempotencyKey: key() });

describe('RequestResolution', () => {
  it("opens a pending request about the Pix's payer, naming the exception and how", async () => {
    const request = await ask(operator, 'stale-carla');

    expect(request).toMatchObject({
      kind: 'RESOLVE_EXCEPTION',
      status: 'PENDING',
      customer: { id: 'carla', name: 'Carla' },
      exception: { id: 'stale-carla', resolution: 'REFUND' },
      transfer: null,
    });
    expect(bank.audit.at(-1)).toMatchObject({
      action: 'REQUEST_CREATED',
      metadata: { kind: 'RESOLVE_EXCEPTION', exceptionId: 'stale-carla', resolution: 'REFUND' },
    });
  });

  it.each(['missing-at-spi', 'clearing'])(
    'refuses %s: only a Pix left waiting is settled or refunded (X1)',
    async (id) => {
      await expect(ask(operator, id)).rejects.toThrow(ExceptionNotSettleable);
    },
  );

  it('refuses a second request while one is pending', async () => {
    await ask(operator, 'stale-carla');

    await expect(ask(operator, 'stale-carla', 'SETTLE')).rejects.toThrow(ExceptionNotOpen);
  });

  it('refuses an exception already explained', async () => {
    await explain(analyst, 'stale-carla');

    await expect(ask(operator, 'stale-carla')).rejects.toThrow(ExceptionNotOpen);
  });

  it('refuses a Pix the SPI already answered (X4)', async () => {
    spiAnswered('pix-carla', E2E.carla);

    await expect(ask(operator, 'stale-carla')).rejects.toThrow(PixNoLongerProcessing);
  });

  it("answers NotFound for an unknown exception, and to the demo staff for a visitor's Pix", async () => {
    await expect(ask(operator, 'nothing')).rejects.toThrow(NotFound);
    await expect(ask(demoOperator, 'stale-visitor')).rejects.toThrow(NotFound);
  });

  it('lets the demo staff ask about a demo customer, in the demo scope', async () => {
    const request = await ask(demoOperator, 'stale-carla');

    expect(bank.requests.get(request.id)?.demoScope).toBe(true);
  });
});

describe('approving a resolution', () => {
  it.each([
    ['REFUND', 'REJECTED', 'REFUNDED'],
    ['SETTLE', 'SETTLED', 'SETTLED'],
  ] as const)(
    '%s ends the Pix as the SPI would, once, by someone other than the requester',
    async (resolution, spiOutcome, outcome) => {
      const request = await ask(operator, 'stale-carla', resolution);

      await expect(approve(operator, request.id)).rejects.toThrow(SelfApprovalNotAllowed);
      const decided = await approve(analyst, request.id);

      expect(decided.status).toBe('APPROVED');
      expect(bank.concluded).toEqual([
        {
          endToEndId: E2E.carla,
          outcome: spiOutcome,
          actorId: 'analyst-1',
          requestId: 'req-2',
          approvalRequestId: request.id,
        },
      ]);
      expect(bank.exceptions.get('stale-carla')?.resolution).toEqual({
        exceptionId: 'stale-carla',
        outcome,
        approvalRequestId: request.id,
        explanation: null,
        resolvedBy: 'analyst-1',
        resolvedAt: NOW,
      });
      expect(bank.audit.map((event) => event.action)).toEqual([
        'REQUEST_CREATED',
        'EXCEPTION_RESOLVED',
        'REQUEST_APPROVED',
      ]);
      await expect(approve(analyst, request.id)).rejects.toThrow(RequestNotPending);
      expect(bank.concluded).toHaveLength(1);
    },
  );

  it('moves nothing and leaves the request pending when the SPI answered first (X4)', async () => {
    const request = await ask(operator, 'stale-carla');
    spiAnswered('pix-carla', E2E.carla);

    await expect(approve(analyst, request.id)).rejects.toThrow(PixNoLongerProcessing);
    expect(bank.concluded).toEqual([]);
    expect(bank.requests.get(request.id)?.decision).toBeNull();
    expect(bank.exceptions.get('stale-carla')?.resolution).toBeNull();
  });
});

describe('ExplainException', () => {
  it('resolves any exception at once, moving no money (X2)', async () => {
    const view = await explain(analyst, 'clearing', '  Tarifa do SPI lançada no dia seguinte.  ');

    expect(view).toMatchObject({
      id: 'clearing',
      status: 'RESOLVED',
      resolution: {
        outcome: 'EXPLAINED',
        explanation: 'Tarifa do SPI lançada no dia seguinte.',
        resolvedBy: { id: 'analyst-1', name: 'Diogo' },
        approvalRequestId: null,
      },
    });
    expect(bank.concluded).toEqual([]);
  });

  it('records who explained, never the explanation, in the audit trail (API-04)', async () => {
    await explain(analyst, 'missing-at-spi');

    expect(bank.audit).toEqual([
      expect.objectContaining({
        action: 'EXCEPTION_RESOLVED',
        actorType: 'STAFF',
        actorId: 'analyst-1',
        subjectType: 'RECONCILIATION_EXCEPTION',
        subjectId: 'missing-at-spi',
        metadata: { kind: 'MISSING_AT_SPI', outcome: 'EXPLAINED' },
      }),
    ]);
  });

  it('refuses an exception with a pending request, or already resolved', async () => {
    await ask(operator, 'stale-carla');
    await explain(analyst, 'clearing');

    await expect(explain(analyst, 'stale-carla')).rejects.toThrow(ExceptionNotOpen);
    await expect(explain(analyst, 'clearing')).rejects.toThrow(ExceptionNotOpen);
  });

  it("lets the demo staff explain the clearing balance, never a visitor's Pix (X5)", async () => {
    await expect(explain(demoAnalyst, 'clearing')).resolves.toMatchObject({ status: 'RESOLVED' });
    await expect(explain(demoAnalyst, 'stale-visitor')).rejects.toThrow(NotFound);
    await expect(explain(demoAnalyst, 'missing-here')).rejects.toThrow(NotFound);
  });
});

describe('the exceptions queue', () => {
  const list = (actor: StaffReader, status: 'OPEN' | 'ALL' = 'OPEN') =>
    new ListExceptions(deps).execute(actor, { status, after: null });

  it('shows the open ones, newest first, with the Pix, its payer and a pending request', async () => {
    const request = await ask(operator, 'stale-carla');
    await explain(analyst, 'missing-here');

    const page = await list(operator);

    expect(page.items.map((item) => item.id)).toEqual([
      'clearing',
      'missing-at-spi',
      'stale-visitor',
      'stale-carla',
    ]);
    expect(page.items.at(-1)).toMatchObject({
      kind: 'STALE_PROCESSING',
      status: 'OPEN',
      endToEndId: E2E.carla,
      pix: {
        id: 'pix-carla',
        amount: { amount: 8_000, currency: 'BRL' },
        status: 'PROCESSING',
        customer: { id: 'carla', name: 'Carla' },
      },
      pendingRequestId: request.id,
      resolution: null,
    });
    expect(page.items[0]).toMatchObject({
      expected: { amount: 10_000, currency: 'BRL' },
      actual: { amount: 9_000, currency: 'BRL' },
      pix: null,
    });
  });

  it('shows the resolved ones too when asked for all', async () => {
    await explain(analyst, 'missing-here');

    const page = await list(operator, 'ALL');

    expect(page.items.find((item) => item.id === 'missing-here')).toMatchObject({
      status: 'RESOLVED',
      pix: null,
      resolution: { outcome: 'EXPLAINED', resolvedBy: { name: 'Diogo' } },
    });
  });

  it("shows the demo staff the demo customers' Pix and the clearing balance only (X5)", async () => {
    const page = await list(demoOperator, 'ALL');

    expect(page.items.map((item) => item.id)).toEqual([
      'clearing',
      'missing-at-spi',
      'stale-carla',
    ]);
    await expect(new GetException(deps).execute(demoOperator, 'stale-visitor')).rejects.toThrow(
      NotFound,
    );
  });

  it('reads one exception, and NotFound for one that does not exist', async () => {
    await expect(new GetException(deps).execute(operator, 'stale-visitor')).resolves.toMatchObject({
      id: 'stale-visitor',
      pix: { customer: { name: 'Visitante' } },
    });
    await expect(new GetException(deps).execute(operator, 'nothing')).rejects.toThrow(NotFound);
  });
});
