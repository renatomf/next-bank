import type {
  PixFailureReason,
  PixTransferState,
  PixTransferStatus,
} from '../domain/pix-transfer.ts';
import type { PixKeyType } from '../domain/pix-key.ts';

/**
 * A Pix as the payer may see it (READ-02): no account id, never the payee's
 * full CPF. Plain JSON, so it can be stored as an idempotent response and sent
 * back unchanged.
 */
export interface PixTransferView {
  id: string;
  status: PixTransferStatus;
  amount: { amount: number; currency: 'BRL' };
  description: string | null;
  payee: {
    name: string;
    documentMasked: string;
    keyType: PixKeyType;
    keyMasked: string;
    /** Only for a payee at another bank. */
    bank?: { ispb: string; name: string };
  };
  endToEndId: string | null;
  failureReason: PixFailureReason | null;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

export function viewOf(state: Readonly<PixTransferState>): PixTransferView {
  return {
    id: state.id,
    status: state.status,
    amount: { amount: state.amount.toJsonAmount(), currency: state.amount.currency },
    description: state.description,
    payee: {
      name: state.payee.name,
      documentMasked: state.payee.documentMasked,
      keyType: state.payee.keyType,
      keyMasked: state.payee.keyMasked,
      ...(state.payee.bank ? { bank: { ...state.payee.bank } } : {}),
    },
    endToEndId: state.endToEndId,
    failureReason: state.failureReason,
    createdAt: state.createdAt.toISOString(),
    expiresAt: state.expiresAt.toISOString(),
    completedAt: state.completedAt?.toISOString() ?? null,
  };
}
