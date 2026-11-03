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
import { formatDateTime, formatMoney } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { ReversalButton } from './reversal-button';

const KINDS: Readonly<Record<Statement['items'][number]['kind'], string>> = {
  PIX_SENT: 'Pix enviado',
  PIX_RECEIVED: 'Pix recebido',
  PIX_REFUNDED: 'Pix devolvido',
  PIX_REVERSED: 'Pix estornado',
  DEMO_FUNDING: 'Saldo inicial',
  TOP_UP: 'Recarga',
};

/**
 * One page of a customer's statement, the counterparty's document masked.
 * With [canReverse], each Pix the customer sent offers its reversal (task 5),
 * except one whose reversal back to the payer, which names it, is on the
 * page. The API refuses any Pix that cannot be reversed: the button only
 * spares that refusal, so a reversal on a newer page still leaves it.
 */
export function StatementList({
  items,
  canReverse = false,
}: {
  items: Statement['items'];
  canReverse?: boolean;
}) {
  if (items.length === 0) return <p className="text-muted-foreground">Nenhum lançamento.</p>;
  const reversed = new Set(
    items.flatMap((item) =>
      item.kind === 'PIX_REVERSED' && item.transferId ? [item.transferId] : [],
    ),
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>O quê</TableHead>
          <TableHead>Com quem</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          {canReverse ? <TableHead className="sr-only">Ações</TableHead> : null}
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
            {canReverse ? (
              <TableCell className="text-right">
                {item.kind === 'PIX_SENT' && item.transferId && !reversed.has(item.transferId) ? (
                  <ReversalButton
                    transferId={item.transferId}
                    amountText={formatMoney(item.amount)}
                    idempotencyKey={newIdempotencyKey()}
                  />
                ) : null}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
