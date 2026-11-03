import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RequestsTable } from '@/features/requests/requests-table';
import { asSignedInMember } from '@/lib/backend';
import { cn } from '@/lib/utils';

const TABS = [
  { status: 'PENDING', label: 'Pendentes' },
  { status: 'ALL', label: 'Todos' },
] as const;

/** The requests queue (v1.3.0 plan, task 4): pending first, a page at a time. */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = params.status === 'ALL' ? 'ALL' : 'PENDING';
  const cursor = typeof params.cursor === 'string' ? params.cursor : null;
  const page = await asSignedInMember((api) => api.listRequests(status, cursor));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Pedidos</h1>
      <nav aria-label="Filtro" className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/requests?status=${tab.status}`}
            aria-current={tab.status === status ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
              tab.status === status
                ? 'bg-selected text-link'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <RequestsTable requests={page.items} />
      {page.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/requests?status=${status}&cursor=${page.nextCursor}`}>
            Mais antigos
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
