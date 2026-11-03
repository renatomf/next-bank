import { ArrowLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AccountActionsPanel } from '@/features/customers/account-actions-panel';
import { CustomerCard } from '@/features/customers/customer-card';
import { StatementList } from '@/features/customers/statement-list';
import { asSignedInMember, signedInMember } from '@/lib/backend';
import { newIdempotencyKey } from '@/lib/idempotency';

/**
 * A customer's card and statement (v1.3.0 plan, task 3). Every load is a
 * read the API audits (STF-07); a customer this member may not see is as
 * missing as one that does not exist (STF-11). The cursor in the URL holds
 * only a position in the statement, no personal data.
 */
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { cursor } = await searchParams;
  const [customer, statement] = await asSignedInMember((api) =>
    Promise.all([
      api.customer(id),
      api.customerStatement(id, typeof cursor === 'string' ? cursor : null),
    ]),
  );
  if (!customer || !statement) notFound();
  const member = await signedInMember();

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/customers">
          <ArrowLeft aria-hidden="true" />
          Clientes
        </Link>
      </Button>
      <CustomerCard customer={customer} />
      <AccountActionsPanel
        customerId={customer.id}
        accountStatus={customer.account.status}
        canBlock={member.role === 'OPERATOR' || member.role === 'ANALYST'}
        canRequest={member.role === 'OPERATOR'}
        blockKey={newIdempotencyKey()}
        requestKey={newIdempotencyKey()}
      />
      <section aria-labelledby="statement-title" className="space-y-4">
        <h2 id="statement-title" className="text-xl font-semibold">
          Extrato
        </h2>
        <StatementList items={statement.items} canReverse={member.role === 'OPERATOR'} />
        {statement.nextCursor ? (
          <Button asChild variant="outline">
            <Link href={`/customers/${id}?cursor=${statement.nextCursor}`}>
              Mais antigos
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}
