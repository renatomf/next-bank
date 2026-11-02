import { MoneyText } from '@/components/nb/money-text';
import { StatusBadge } from '@/components/nb/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CustomerCard as CustomerCardData } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const CUSTOMER_STATUS = {
  ACTIVE: { tone: 'ok', label: 'Cliente ativo' },
  LOCKED: { tone: 'blocked', label: 'Cliente bloqueado' },
} as const;

const ACCOUNT_STATUS = {
  ACTIVE: { tone: 'ok', label: 'Conta ativa' },
  BLOCKED: { tone: 'blocked', label: 'Conta bloqueada' },
  CLOSED: { tone: 'closed', label: 'Conta encerrada' },
} as const;

/**
 * A customer's card (v1.3.0 plan, task 3): the documents only masked
 * (STF-07), and what the customer wrote shown as text by React (STF-05).
 */
export function CustomerCard({ customer }: { customer: CustomerCardData }) {
  const facts = [
    ['CPF', customer.cpfMasked],
    ['E-mail', customer.emailMasked],
    ['Conta', `${customer.account.branch} · ${customer.account.number}`],
    ['Aberta em', formatDateTime(customer.account.openedAt)],
  ] as const;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <CardTitle className="text-2xl break-words">{customer.name}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <StatusBadge {...CUSTOMER_STATUS[customer.status]} />
            <StatusBadge {...ACCOUNT_STATUS[customer.account.status]} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <MoneyText money={customer.balance} className="text-3xl font-semibold" />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
