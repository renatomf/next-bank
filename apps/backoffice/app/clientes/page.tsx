import Link from 'next/link';
import { READS_CUSTOMERS, signedInMember } from '../../lib/backend';
import { SearchForm } from './search-form';

/** The staff's search for customers (v1.3.0 plan, task 3). */
export default async function CustomersPage() {
  const member = await signedInMember();

  return (
    <main className="page">
      <nav>
        <Link href="/">← Início</Link>
      </nav>
      <h1 className="brand">Clientes</h1>
      {READS_CUSTOMERS.includes(member.role) ? (
        <SearchForm />
      ) : (
        <p className="muted">Seu papel não consulta clientes.</p>
      )}
    </main>
  );
}
