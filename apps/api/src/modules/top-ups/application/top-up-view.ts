import { type TopUpOperator, operatorById } from '../domain/operator.ts';
import type { TopUpState } from './ports.ts';

/**
 * The receipt of a top-up (READ-02): no account id, never the number in
 * full. Plain JSON, like the Pix view, so it can be stored as the idempotent
 * response and sent back unchanged.
 */
export interface TopUpView {
  id: string;
  operator: TopUpOperator;
  phoneMasked: string;
  amount: { amount: number; currency: 'BRL' };
  status: 'COMPLETED';
  createdAt: string;
}

export function viewOf(state: TopUpState): TopUpView {
  const { id, name, initials } = operatorById(state.operatorId);
  return {
    id: state.id,
    operator: { id, name, initials },
    phoneMasked: state.phoneMasked,
    amount: { amount: state.amount.toJsonAmount(), currency: state.amount.currency },
    status: state.status,
    createdAt: state.createdAt.toISOString(),
  };
}
