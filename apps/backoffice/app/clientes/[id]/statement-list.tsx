import type { Statement } from '../../../lib/api';
import { formatDateTime, formatMoney } from '../../../lib/format';

const KINDS: Readonly<Record<Statement['items'][number]['kind'], string>> = {
  PIX_SENT: 'Pix enviado',
  PIX_RECEIVED: 'Pix recebido',
  PIX_REFUNDED: 'Pix devolvido',
  DEMO_FUNDING: 'Saldo inicial',
  TOP_UP: 'Recarga',
};

/** One page of a customer's statement, the counterparty's document masked. */
export function StatementList({ items }: { items: Statement['items'] }) {
  if (items.length === 0) return <p className="muted">Nenhum lançamento.</p>;
  return (
    <table className="statement">
      <thead>
        <tr>
          <th scope="col">Quando</th>
          <th scope="col">O quê</th>
          <th scope="col">Com quem</th>
          <th scope="col">Valor</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{formatDateTime(item.occurredAt)}</td>
            <td>{KINDS[item.kind]}</td>
            <td>
              {item.counterparty
                ? `${item.counterparty.name}${item.counterparty.documentMasked ? ` · ${item.counterparty.documentMasked}` : ''}`
                : '—'}
            </td>
            <td className={item.direction === 'IN' ? 'in' : 'out'}>
              {item.direction === 'OUT' ? '- ' : '+ '}
              {formatMoney(item.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
