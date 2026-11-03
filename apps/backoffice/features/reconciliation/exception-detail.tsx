import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReconciliationException } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { EXCEPTION_KIND_LABELS, OUTCOME_LABELS } from '@/lib/staff-words';
import { ExceptionStatusBadge } from './exception-status-badge';

const PIX_STATUS: Readonly<Record<string, string>> = {
  PROCESSING: 'Esperando o SPI',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
};

/** 2026-11-02 as the staff reads it: 02/11/2026. */
const dayOf = (date: string) => date.split('-').reverse().join('/');

/**
 * What the daily reconciliation found and how it was resolved (v1.3.0 plan,
 * task 6): the SPI's side as expected, next bank's as found. The
 * explanation is the staff's own words, shown as text (STF-05).
 */
export function ExceptionDetail({ exception }: { exception: ReconciliationException }) {
  const { pix, resolution } = exception;
  const facts: [string, string][] = [
    ['Dia conciliado', dayOf(exception.runDate)],
    ['Encontrada em', formatDateTime(exception.detectedAt)],
  ];
  if (exception.endToEndId) facts.push(['Id de ponta a ponta', exception.endToEndId]);
  if (pix) {
    facts.push(['Valor do Pix', formatMoney(pix.amount)]);
    facts.push(['Cliente', pix.customer.name]);
    facts.push(['Situação do Pix', PIX_STATUS[pix.status] ?? pix.status]);
  }
  if (exception.expected) facts.push(['Esperado (SPI)', formatMoney(exception.expected)]);
  if (exception.actual) facts.push(['Encontrado (next bank)', formatMoney(exception.actual)]);
  if (resolution) {
    facts.push([OUTCOME_LABELS[resolution.outcome], resolution.resolvedBy.name]);
    facts.push(['Em', formatDateTime(resolution.resolvedAt)]);
    if (resolution.explanation) facts.push(['Explicação', resolution.explanation]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-2xl">{EXCEPTION_KIND_LABELS[exception.kind]}</CardTitle>
        <ExceptionStatusBadge exception={exception} />
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
