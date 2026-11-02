import type { CustomerCard as Card } from '../../../lib/api';
import { formatDateTime, formatMoney } from '../../../lib/format';

const CUSTOMER_STATUS: Readonly<Record<Card['status'], string>> = {
  ACTIVE: 'Ativo',
  LOCKED: 'Bloqueado',
};

const ACCOUNT_STATUS: Readonly<Record<Card['account']['status'], string>> = {
  ACTIVE: 'Ativa',
  BLOCKED: 'Bloqueada',
  CLOSED: 'Encerrada',
};

/**
 * A customer's card (v1.3.0 plan, task 3): the documents only masked
 * (STF-07), and what the customer wrote shown as text by React (STF-05).
 */
export function CustomerCard({ customer }: { customer: Card }) {
  return (
    <section className="card wide" aria-labelledby="customer-name">
      <h1 id="customer-name" className="brand">
        {customer.name}
      </h1>
      <p className="muted">{CUSTOMER_STATUS[customer.status]}</p>
      <dl className="facts">
        <dt>CPF</dt>
        <dd>{customer.cpfMasked}</dd>
        <dt>E-mail</dt>
        <dd>{customer.emailMasked}</dd>
        <dt>Conta</dt>
        <dd>
          {customer.account.branch} · {customer.account.number} (
          {ACCOUNT_STATUS[customer.account.status]})
        </dd>
        <dt>Aberta em</dt>
        <dd>{formatDateTime(customer.account.openedAt)}</dd>
        <dt>Saldo</dt>
        <dd>{formatMoney(customer.balance)}</dd>
      </dl>
    </section>
  );
}
