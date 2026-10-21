import { describe, expect, it } from 'vitest';
import {
  InvalidTopUpAmount,
  UnknownTopUpOperator,
} from '../../../../src/modules/top-ups/domain/errors.ts';
import {
  TOP_UP_AMOUNTS,
  TOP_UP_OPERATORS,
  assertOfferedAmount,
  operatorById,
} from '../../../../src/modules/top-ups/domain/operator.ts';
import { Money } from '../../../../src/shared/domain/money.ts';

// D6 (v1.1.0 plan, task 5; decision R2): three made-up operators, never a
// real carrier's mark, and four fixed amounts.
describe('top-up operators', () => {
  it('offers the three made-up operators, with initials in place of a logo', () => {
    expect(TOP_UP_OPERATORS).toEqual([
      { id: 'onda-movel', name: 'Onda Móvel', initials: 'OM' },
      { id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC' },
      { id: 'rede-nova', name: 'Rede Nova', initials: 'RN' },
    ]);
  });

  it('finds an operator by id', () => {
    expect(operatorById('rede-nova').name).toBe('Rede Nova');
  });

  it('refuses an operator it does not have (UnknownTopUpOperator)', () => {
    expect(() => operatorById('vivo')).toThrow(UnknownTopUpOperator);
  });
});

describe('top-up amounts', () => {
  it('offers R$ 15, 20, 30 and 50, in cents', () => {
    expect(TOP_UP_AMOUNTS.map((amount) => amount.cents)).toEqual([1500n, 2000n, 3000n, 5000n]);
  });

  it('accepts an offered amount', () => {
    expect(() => {
      assertOfferedAmount(Money.of(3000n));
    }).not.toThrow();
  });

  it.each([
    ['one cent less', 1499n],
    ['an amount between two offers', 2500n],
    ['zero', 0n],
  ])('refuses %s (InvalidTopUpAmount)', (_case, cents) => {
    expect(() => {
      assertOfferedAmount(Money.of(cents));
    }).toThrow(InvalidTopUpAmount);
  });
});
