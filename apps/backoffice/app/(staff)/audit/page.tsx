import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuditTable } from '@/features/audit/audit-table';
import type { AuditFilter } from '@/lib/api';
import { asSignedInMember, signedInMember } from '@/lib/backend';

const TITLES = {
  customerId: 'Trilha do cliente',
  memberId: 'Trilha do membro da equipe',
  requestId: 'Trilha do pedido',
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The one filter in the URL, or none (task 8, H2): the API takes exactly one. */
function filterOf(params: Record<string, string | string[] | undefined>): AuditFilter | null {
  const given = (['customerId', 'memberId', 'requestId'] as const).flatMap((key) => {
    const value = params[key];
    return typeof value === 'string' && UUID.test(value) ? [{ [key]: value } as AuditFilter] : [];
  });
  return given.length === 1 ? (given[0] ?? null) : null;
}

/**
 * The audit trail (v1.3.0 plan, task 8): who did what and when, opened from
 * a customer's card, a request or the staff, always by one filter. A trail
 * this member may not see is as missing as one that does not exist.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const member = await signedInMember();
  const filter = filterOf(params);
  const header = <h1 className="text-3xl font-semibold tracking-tight">Auditoria</h1>;
  if (member.role !== 'ANALYST' && member.role !== 'ADMIN') {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-muted-foreground">Seu papel não lê a trilha de auditoria.</p>
      </div>
    );
  }
  if (!filter) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-muted-foreground">
          A trilha abre sempre por um filtro: use &quot;Ver trilha&quot; na ficha de um cliente, num
          pedido ou na Equipe.
        </p>
      </div>
    );
  }
  const cursor = typeof params.cursor === 'string' ? params.cursor : null;
  const page = await asSignedInMember((api) => api.auditTrail(filter, cursor));
  if (!page) notFound();
  const [key, value] = Object.entries(filter)[0] ?? ['', ''];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        {header}
        <p className="text-muted-foreground">
          {TITLES[key as keyof typeof TITLES]} <span className="font-mono text-xs">{value}</span>
        </p>
      </div>
      <AuditTable entries={page.items} />
      {page.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/audit?${key}=${value}&cursor=${page.nextCursor}`}>
            Mais antigos
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
