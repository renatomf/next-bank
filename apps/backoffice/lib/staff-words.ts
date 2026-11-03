import type { ApprovalRequest, Reason, ReconciliationException, Resolution } from './api';

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

export const KIND_LABELS: Readonly<Record<ApprovalRequest['kind'], string>> = {
  UNBLOCK_ACCOUNT: 'Desbloqueio de conta',
  REVERSE_PIX: 'Estorno de Pix',
  RESOLVE_EXCEPTION: 'Resolução de exceção',
};

/** What approving each kind of request does, said before the analyst decides. */
export const APPROVAL_EFFECTS: Readonly<Record<ApprovalRequest['kind'], string>> = {
  UNBLOCK_ACCOUNT: 'Aprovar desbloqueia a conta na hora, e o cliente volta a entrar.',
  REVERSE_PIX: 'Aprovar devolve o valor do Pix a quem pagou, na hora.',
  RESOLVE_EXCEPTION: 'Aprovar encerra o Pix parado como o SPI faria: liquida ou devolve, na hora.',
};

/** The divergences the daily reconciliation finds (v1.3.0 plan, task 6). */
export const EXCEPTION_KIND_LABELS: Readonly<Record<ReconciliationException['kind'], string>> = {
  MISSING_HERE: 'Pix que só o SPI tem',
  MISSING_AT_SPI: 'Pix que o SPI não liquidou',
  AMOUNT_MISMATCH: 'Valor diferente do SPI',
  STATUS_MISMATCH: 'Situação diferente do SPI',
  STALE_PROCESSING: 'Pix parado sem resposta do SPI',
  CLEARING_MISMATCH: 'Saldo da conta de compensação',
};

export const RESOLUTION_LABELS: Readonly<Record<Resolution, string>> = {
  SETTLE: 'Liquidar',
  REFUND: 'Estornar',
};

export const OUTCOME_LABELS: Readonly<
  Record<NonNullable<ReconciliationException['resolution']>['outcome'], string>
> = {
  SETTLED: 'Liquidada',
  REFUNDED: 'Estornada',
  EXPLAINED: 'Explicada',
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
  PixNotReversible: 'Só um Pix interno concluído, ainda não estornado, pode ser estornado.',
  PayeeInsufficientFunds:
    'Quem recebeu o Pix não tem mais o valor. O pedido continua pendente: tente mais tarde ou recuse.',
  ExceptionNotOpen: 'Esta exceção já foi resolvida ou tem um pedido pendente.',
  ExceptionNotSettleable: 'Só um Pix parado sem resposta do SPI pode ser liquidado ou estornado.',
  PixNoLongerProcessing:
    'O SPI já respondeu este Pix. Nada foi movido: recuse o pedido e explique a exceção.',
};

/** What to tell the member about a refused command. */
export function refusalMessage(code: string): string {
  return REFUSALS[code] ?? 'Não foi possível concluir agora. Tente de novo.';
}
