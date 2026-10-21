import { Money } from '../../../shared/domain/money.ts';
import { InvalidTopUpAmount, UnknownTopUpOperator } from './errors.ts';

/** A phone operator a top-up goes to: made up, never a real carrier's mark (D6, R2). */
export interface TopUpOperator {
  /** Stable id, part of the operator's ledger account code. */
  readonly id: string;
  readonly name: string;
  /** Shown in place of a logo. */
  readonly initials: string;
}

export const TOP_UP_OPERATORS: readonly TopUpOperator[] = [
  { id: 'onda-movel', name: 'Onda Móvel', initials: 'OM' },
  { id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC' },
  { id: 'rede-nova', name: 'Rede Nova', initials: 'RN' },
];

/** R$ 15, 20, 30 and 50, the same for every operator (D6). */
export const TOP_UP_AMOUNTS: readonly Money[] = [1500n, 2000n, 3000n, 5000n].map((cents) =>
  Money.of(cents),
);

export function operatorById(id: string): TopUpOperator {
  const operator = TOP_UP_OPERATORS.find((candidate) => candidate.id === id);
  if (!operator) throw new UnknownTopUpOperator();
  return operator;
}

export function assertOfferedAmount(amount: Money): void {
  if (!TOP_UP_AMOUNTS.some((offered) => offered.equals(amount))) {
    throw new InvalidTopUpAmount();
  }
}
