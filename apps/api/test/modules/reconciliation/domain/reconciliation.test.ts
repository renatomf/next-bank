import { describe, expect, it } from 'vitest';
import {
  dayToReconcile,
  findDivergences,
  type ReconciliationInput,
  saoPauloDay,
} from '../../../../src/modules/reconciliation/domain/reconciliation.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// The day's reconciliation (v1.2.0 plan, task 6; EXT-04): the SPI's
// settlement file against next bank's Pix to other banks, matched by
// end-to-end id (R1). Every divergence is found, and a day without any
// finds nothing.
const e2e = (n: number) => `E00000000202510261200${String(n).padStart(11, '0')}`;
const reais = (cents: number) => Money.of(BigInt(cents));

/** A day where both sides agree: one Pix settled and completed, none waiting. */
function agreeing(changes: Partial<ReconciliationInput> = {}): ReconciliationInput {
  return {
    settledOnDay: [{ endToEndId: e2e(1), amount: reais(5_000) }],
    settledDayBefore: [],
    ours: new Map([[e2e(1), { amount: reais(5_000), status: 'COMPLETED' }]]),
    completedOnDay: [e2e(1)],
    stale: [],
    clearing: { balance: reais(0), processingSum: reais(0) },
    ...changes,
  };
}

describe('findDivergences', () => {
  it('finds nothing on a day where both sides agree', () => {
    expect(findDivergences(agreeing())).toEqual([]);
  });

  it('finds a payment the SPI settled that next bank does not have', () => {
    expect(findDivergences(agreeing({ ours: new Map() }))).toEqual([
      { kind: 'MISSING_HERE', endToEndId: e2e(1), expected: reais(5_000), actual: null },
    ]);
  });

  it('finds a payment settled with another amount', () => {
    const ours = new Map([[e2e(1), { amount: reais(4_000), status: 'COMPLETED' as const }]]);

    expect(findDivergences(agreeing({ ours }))).toEqual([
      { kind: 'AMOUNT_MISMATCH', endToEndId: e2e(1), expected: reais(5_000), actual: reais(4_000) },
    ]);
  });

  it.each(['PROCESSING', 'FAILED'] as const)(
    'finds a payment the SPI settled that next bank has %s',
    (status) => {
      const ours = new Map([[e2e(1), { amount: reais(5_000), status }]]);

      expect(findDivergences(agreeing({ ours, completedOnDay: [] }))).toEqual([
        { kind: 'STATUS_MISMATCH', endToEndId: e2e(1), expected: null, actual: null },
      ]);
    },
  );

  it('finds a Pix next bank completed that the SPI never settled', () => {
    expect(findDivergences(agreeing({ completedOnDay: [e2e(1), e2e(2)] }))).toEqual([
      { kind: 'MISSING_AT_SPI', endToEndId: e2e(2), expected: null, actual: null },
    ]);
  });

  // R1: next bank completes after the SPI settles, sometimes past midnight.
  it('finds a Pix completed today in the settlement of the day before', () => {
    const input = agreeing({
      settledDayBefore: [{ endToEndId: e2e(2), amount: reais(1_000) }],
      completedOnDay: [e2e(1), e2e(2)],
    });

    expect(findDivergences(input)).toEqual([]);
  });

  // R2: over a day without the SPI's answer, a person must look.
  it('finds a Pix waiting for the SPI for over a day', () => {
    expect(findDivergences(agreeing({ stale: [e2e(3)] }))).toEqual([
      { kind: 'STALE_PROCESSING', endToEndId: e2e(3), expected: null, actual: null },
    ]);
  });

  // domain-model.md §6: the clearing account holds exactly the Pix waiting.
  it('finds a clearing balance that is not the sum of the Pix waiting', () => {
    const input = agreeing({ clearing: { balance: reais(900), processingSum: reais(1_000) } });

    expect(findDivergences(input)).toEqual([
      { kind: 'CLEARING_MISMATCH', endToEndId: null, expected: reais(1_000), actual: reais(900) },
    ]);
  });

  it('finds every divergence of a day at once, in the order of the checks', () => {
    const input = agreeing({
      ours: new Map(),
      completedOnDay: [e2e(2)],
      stale: [e2e(3)],
      clearing: { balance: reais(1), processingSum: reais(0) },
    });

    expect(findDivergences(input).map((divergence) => divergence.kind)).toEqual([
      'MISSING_HERE',
      'MISSING_AT_SPI',
      'STALE_PROCESSING',
      'CLEARING_MISMATCH',
    ]);
  });
});

// The day is São Paulo's (UTC−3, no daylight saving since 2019), as the SPI's
// settlement file counts it.
describe('saoPauloDay', () => {
  it('starts and ends at midnight in São Paulo, and knows the day before', () => {
    expect(saoPauloDay('2026-10-26')).toEqual({
      start: new Date('2026-10-26T03:00:00.000Z'),
      end: new Date('2026-10-27T03:00:00.000Z'),
      dayBefore: '2026-10-25',
    });
  });

  it('crosses months and years', () => {
    expect(saoPauloDay('2026-01-01').dayBefore).toBe('2025-12-31');
    expect(saoPauloDay('2028-03-01').dayBefore).toBe('2028-02-29');
  });
});

// R3: at 03:00 in São Paulo, the day before is reconciled.
describe('dayToReconcile', () => {
  it('is the day before, from 03:00 in São Paulo', () => {
    expect(dayToReconcile(new Date('2026-10-27T06:00:00.000Z'))).toBe('2026-10-26');
    expect(dayToReconcile(new Date('2026-10-28T02:59:59.000Z'))).toBe('2026-10-26');
  });

  it('before 03:00 in São Paulo, is still the day before that, while yesterday may settle', () => {
    expect(dayToReconcile(new Date('2026-10-27T05:59:59.000Z'))).toBe('2026-10-25');
  });
});
