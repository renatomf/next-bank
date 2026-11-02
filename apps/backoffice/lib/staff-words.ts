import type { ApprovalRequest, Reason } from './api';

/** The reasons the staff picks from (v1.3.0 plan, task 4): codes for the API, words here. */
export const REASON_LABELS: Readonly<Record<Reason, string>> = {
  FRAUD_SUSPECTED: 'Suspeita de fraude',
  CUSTOMER_REQUEST: 'Pedido do cliente',
  LEGAL_ORDER: 'Ordem judicial',
  OTHER: 'Outro motivo',
};

export const STATUS_LABELS: Readonly<Record<ApprovalRequest['status'], string>> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
};

const REFUSALS: Readonly<Record<string, string>> = {
  AccountAlreadyBlocked: 'Esta conta já está bloqueada.',
  AccountNotBlocked: 'Esta conta não está bloqueada.',
  RequestAlreadyOpen: 'Já existe um pedido de desbloqueio aberto para esta conta.',
  RequestNotPending: 'Este pedido já foi decidido, cancelado ou venceu.',
  SelfApprovalNotAllowed: 'Quem fez o pedido não pode decidi-lo.',
  NotTheRequester: 'Só quem fez o pedido pode cancelá-lo.',
  DemoCustomerProtected: 'A equipe de demonstração não bloqueia Ana nem Bruno. Use a Carla.',
  Forbidden: 'Seu papel não faz esta ação.',
  NotFound: 'Não encontramos este cliente ou pedido.',
  InvalidRequest: 'Confira os dados e tente de novo.',
};

/** What to tell the member about a refused command. */
export function refusalMessage(code: string): string {
  return REFUSALS[code] ?? 'Não foi possível concluir agora. Tente de novo.';
}
