'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { searchCustomers, type SearchState } from './actions';

const NOTHING_YET: SearchState = { result: null, error: null };

/** One field for a CPF, an e-mail, an account or the start of a name (task 3, C2). */
export function SearchForm() {
  const [state, action, pending] = useActionState(searchCustomers, NOTHING_YET);

  return (
    <>
      <form action={action} className="search">
        <label htmlFor="query">CPF, e-mail, conta ou nome</label>
        <input id="query" name="query" minLength={3} maxLength={120} autoComplete="off" required />
        <button type="submit" disabled={pending}>
          {pending ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      {state.error ? (
        <p className="error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.result ? (
        <section aria-label="Resultados">
          {state.result.customers.length === 0 ? (
            <p className="muted">Nenhum cliente encontrado.</p>
          ) : (
            <ul className="results">
              {state.result.customers.map((customer) => (
                <li key={customer.id}>
                  <Link href={`/clientes/${customer.id}`}>{customer.name}</Link>
                  <span className="muted">
                    {customer.cpfMasked} · {customer.account.branch} · {customer.account.number}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state.result.truncated ? (
            <p className="muted">Mais de 20 resultados: refine a busca.</p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
