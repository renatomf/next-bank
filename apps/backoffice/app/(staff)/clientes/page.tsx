import { READS_CUSTOMERS, signedInMember } from '@/lib/backend';
import { SearchForm } from '@/features/customers/search-form';

/** The staff's search for customers (v1.3.0 plan, task 3). */
export default async function CustomersPage() {
  const member = await signedInMember();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
      {READS_CUSTOMERS.includes(member.role) ? (
        <SearchForm />
      ) : (
        <p className="text-muted-foreground">Seu papel não consulta clientes.</p>
      )}
    </div>
  );
}
