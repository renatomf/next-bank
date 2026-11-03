import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ExceptionsTable } from '@/features/reconciliation/exceptions-table';
import { asSignedInMember } from '@/lib/backend';
import { cn } from '@/lib/utils';

const TABS = [
  { status: 'OPEN', label: 'Abertas' },
  { status: 'ALL', label: 'Todas' },
] as const;

/** The reconciliation's exceptions (v1.3.0 plan, task 6): the open ones first, a page at a time. */
export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = params.status === 'ALL' ? 'ALL' : 'OPEN';
  const cursor = typeof params.cursor === 'string' ? params.cursor : null;
  const page = await asSignedInMember((api) => api.listExceptions(status, cursor));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Conciliação</h1>
        <p className="text-muted-foreground">
          O que a conciliação diária encontrou de diferente entre o next bank e o SPI.
        </p>
      </div>
      <nav aria-label="Filtro" className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/reconciliation?status=${tab.status}`}
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
      <ExceptionsTable exceptions={page.items} />
      {page.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/reconciliation?status=${status}&cursor=${page.nextCursor}`}>
            Mais antigas
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
