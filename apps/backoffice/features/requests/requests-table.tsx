import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ApprovalRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { KIND_LABELS, REASON_LABELS } from '@/lib/staff-words';
import { RequestStatusBadge } from './request-status-badge';

/** One page of the requests queue, newest first, each row leading to its request. */
export function RequestsTable({ requests }: { requests: ApprovalRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-muted-foreground">Nenhum pedido aqui.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Pedido por</TableHead>
          <TableHead>Quando</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow key={request.id}>
            <TableCell>
              <Link
                href={`/requests/${request.id}`}
                className="font-semibold text-link hover:underline"
              >
                {KIND_LABELS[request.kind]}
              </Link>
            </TableCell>
            <TableCell>{request.customer.name}</TableCell>
            <TableCell>{REASON_LABELS[request.reason]}</TableCell>
            <TableCell>{request.requestedBy.name}</TableCell>
            <TableCell>{formatDateTime(request.requestedAt)}</TableCell>
            <TableCell>
              <RequestStatusBadge status={request.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
