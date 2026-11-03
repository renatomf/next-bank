import { describe, expect, it } from 'vitest';
import {
  ExceptionNotOpen,
  ExceptionNotSettleable,
  InvalidExplanation,
} from '../../../../src/modules/operations/domain/errors.ts';
import {
  type ExceptionKind,
  ReconciliationException,
} from '../../../../src/modules/operations/domain/reconciliation-exception.ts';

// An exception the daily reconciliation found, as the staff resolves it
// (v1.3.0 plan, task 6; ADR 0018, R5, D7): it never changes, and its one
// resolution is a record of its own. Only a Pix left waiting for the SPI is
// settled or refunded (X1); any exception may be explained, moving no money
// (X2).
const NOW = new Date('2026-11-03T15:00:00.000Z');

function exception(kind: ExceptionKind = 'STALE_PROCESSING') {
  return ReconciliationException.restore({
    id: 'exception-1',
    runDate: '2026-11-02',
    kind,
    endToEndId: kind === 'CLEARING_MISMATCH' ? null : 'E00000000202611021200abcdefghijk',
    expected: null,
    actual: null,
    detectedAt: new Date('2026-11-03T06:30:00.000Z'),
    resolution: null,
  });
}

describe('ReconciliationException', () => {
  it('is open until resolved', () => {
    const found = exception();
    expect(found.isOpen).toBe(true);

    found.resolve('SETTLE', 'request-1', 'analyst-1', NOW);

    expect(found.isOpen).toBe(false);
  });

  it.each([
    ['SETTLE', 'SETTLED'],
    ['REFUND', 'REFUNDED'],
  ] as const)('%s a Pix left waiting, with the request that approved it', (how, outcome) => {
    const found = exception();

    found.resolve(how, 'request-1', 'analyst-1', NOW);

    expect(found.state.resolution).toEqual({
      exceptionId: 'exception-1',
      outcome,
      approvalRequestId: 'request-1',
      explanation: null,
      resolvedBy: 'analyst-1',
      resolvedAt: NOW,
    });
  });

  it.each([
    'MISSING_HERE',
    'MISSING_AT_SPI',
    'AMOUNT_MISMATCH',
    'STATUS_MISMATCH',
    'CLEARING_MISMATCH',
  ] as const)('never settles nor refunds %s: only a Pix left waiting (X1)', (kind) => {
    const found = exception(kind);

    expect(() => {
      found.assertSettleable();
    }).toThrow(ExceptionNotSettleable);
    expect(() => {
      found.resolve('REFUND', 'request-1', 'analyst-1', NOW);
    }).toThrow(ExceptionNotSettleable);
    expect(found.isOpen).toBe(true);
  });

  it('explains any exception, the explanation trimmed (X2)', () => {
    const found = exception('CLEARING_MISMATCH');

    found.explain('  Conferido com o SPI: tarifa do dia.  ', 'analyst-1', NOW);

    expect(found.state.resolution).toEqual({
      exceptionId: 'exception-1',
      outcome: 'EXPLAINED',
      approvalRequestId: null,
      explanation: 'Conferido com o SPI: tarifa do dia.',
      resolvedBy: 'analyst-1',
      resolvedAt: NOW,
    });
  });

  it.each(['   curto   ', 'x'.repeat(501)])(
    'refuses an explanation under 10 characters or over 500',
    (explanation) => {
      expect(() => {
        exception().explain(explanation, 'analyst-1', NOW);
      }).toThrow(InvalidExplanation);
    },
  );

  it('is resolved once: neither settled, refunded nor explained again', () => {
    const found = exception();
    found.explain('Conferido com o SPI: devolvido.', 'analyst-1', NOW);

    expect(() => {
      found.assertSettleable();
    }).toThrow(ExceptionNotOpen);
    expect(() => {
      found.resolve('SETTLE', 'request-1', 'analyst-2', NOW);
    }).toThrow(ExceptionNotOpen);
    expect(() => {
      found.explain('Outra explicação qualquer.', 'analyst-2', NOW);
    }).toThrow(ExceptionNotOpen);
  });
});
