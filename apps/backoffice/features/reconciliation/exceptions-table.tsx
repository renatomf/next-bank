import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ReconciliationException } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { EXCEPTION_KIND_LABELS } from '@/lib/staff-words';
import { ExceptionStatusBadge } from './exception-status-badge';

/** One page of the exceptions queue, newest first, each row leading to its exception. */
export function ExceptionsTable({ exceptions }: { exceptions: ReconciliationException[] }) {
  if (exceptions.length === 0) {
    return <p className="text-muted-foreground">Nenhuma exceção aqui.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Exceção</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Encontrada em</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {exceptions.map((exception) => (
          <TableRow key={exception.id}>
            <TableCell>
              <Link
                href={`/reconciliation/${exception.id}`}
                className="font-semibold text-link hover:underline"
              >
                {EXCEPTION_KIND_LABELS[exception.kind]}
              </Link>
            </TableCell>
            <TableCell>{exception.pix?.customer.name ?? '—'}</TableCell>
            <TableCell>{exception.pix ? formatMoney(exception.pix.amount) : '—'}</TableCell>
            <TableCell>{formatDateTime(exception.detectedAt)}</TableCell>
            <TableCell>
              <ExceptionStatusBadge exception={exception} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
