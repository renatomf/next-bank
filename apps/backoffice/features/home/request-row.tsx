import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { MoneyText } from '@/components/nb/money-text';
import type { ApprovalRequest } from '@/lib/api';
import { KIND_LABELS } from '@/lib/staff-words';

/**
 * A request in a home block, leading to its page: what it is, whose account,
 * the amount when it moves money, and who asked. Only the customer's name,
 * as the requests list shows it (STF-07).
 */
export function RequestRow({ request, status }: { request: ApprovalRequest; status: ReactNode }) {
  return (
    <li>
      <Link
        href={`/requests/${request.id}`}
        className="-mx-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-3 transition-colors hover:bg-accent"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{KIND_LABELS[request.kind]}</span>
          <span className="block text-sm text-muted-foreground">
            {request.customer.name} · pedido por {request.requestedBy.name}
          </span>
        </span>
        {request.transfer ? <MoneyText money={request.transfer.amount} /> : null}
        {status}
        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
}
