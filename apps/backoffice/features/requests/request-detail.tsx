import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ApprovalRequest } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { KIND_LABELS, REASON_LABELS, RESOLUTION_LABELS } from '@/lib/staff-words';
import { RequestStatusBadge } from './request-status-badge';

const DECISIONS: Readonly<Record<NonNullable<ApprovalRequest['decision']>['decision'], string>> = {
  APPROVED: 'Aprovado por',
  REJECTED: 'Recusado por',
  CANCELLED: 'Cancelado por',
};

/**
 * Who asked what, about whom, and who decided (v1.3.0 plan, task 4). The
 * notes are the staff's own words, shown as text (STF-05).
 */
export function RequestDetail({ request }: { request: ApprovalRequest }) {
  const facts: [string, string][] = [
    ['Cliente', request.customer.name],
    ...(request.transfer
      ? ([
          ['Valor do Pix', formatMoney(request.transfer.amount)],
          ['Recebedor', request.transfer.payeeName],
        ] as [string, string][])
      : []),
    ...(request.exception
      ? ([['Resolução', RESOLUTION_LABELS[request.exception.resolution]]] as [string, string][])
      : []),
    ['Motivo', REASON_LABELS[request.reason]],
    ['Pedido por', request.requestedBy.name],
    ['Pedido em', formatDateTime(request.requestedAt)],
    ['Vence em', formatDateTime(request.expiresAt)],
  ];
  if (request.note) facts.push(['Observação', request.note]);
  if (request.decision) {
    facts.push([DECISIONS[request.decision.decision], request.decision.decidedBy.name]);
    facts.push(['Em', formatDateTime(request.decision.decidedAt)]);
    if (request.decision.note) facts.push(['Nota da decisão', request.decision.note]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-2xl">{KIND_LABELS[request.kind]}</CardTitle>
        <RequestStatusBadge status={request.status} />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
