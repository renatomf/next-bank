import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asSignedInMember } from '../../../lib/backend';
import { CustomerCard } from './customer-card';
import { StatementList } from './statement-list';

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

  return (
    <main className="page">
      <nav>
        <Link href="/clientes">← Clientes</Link>
      </nav>
      <CustomerCard customer={customer} />
      <section aria-labelledby="statement-title">
        <h2 id="statement-title">Extrato</h2>
        <StatementList items={statement.items} />
        {statement.nextCursor ? (
          <Link href={`/clientes/${id}?cursor=${statement.nextCursor}`}>Mais antigos →</Link>
        ) : null}
      </section>
    </main>
  );
}
