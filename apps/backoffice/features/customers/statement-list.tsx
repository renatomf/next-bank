import { MoneyText } from '@/components/nb/money-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Statement } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const KINDS: Readonly<Record<Statement['items'][number]['kind'], string>> = {
  PIX_SENT: 'Pix enviado',
  PIX_RECEIVED: 'Pix recebido',
  PIX_REFUNDED: 'Pix devolvido',
  DEMO_FUNDING: 'Saldo inicial',
  TOP_UP: 'Recarga',
};

/** One page of a customer's statement, the counterparty's document masked. */
export function StatementList({ items }: { items: Statement['items'] }) {
  if (items.length === 0) return <p className="text-muted-foreground">Nenhum lançamento.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>O quê</TableHead>
          <TableHead>Com quem</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{formatDateTime(item.occurredAt)}</TableCell>
            <TableCell>{KINDS[item.kind]}</TableCell>
            <TableCell>
              {item.counterparty ? (
                <>
                  {item.counterparty.name}
                  {item.counterparty.documentMasked ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {item.counterparty.documentMasked}
                    </span>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </TableCell>
            <TableCell className="text-right">
              <MoneyText money={item.amount} direction={item.direction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
