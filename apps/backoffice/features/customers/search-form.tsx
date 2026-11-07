'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchCustomers, type SearchState } from './actions';

const NOTHING_YET: SearchState = { result: null, error: null };

/** One field for a CPF, an e-mail, an account or the start of a name (task 3, C2). */
export function SearchForm() {
  const [state, action, pending] = useActionState(searchCustomers, NOTHING_YET);

  return (
    <div className="space-y-6">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-2">
          <Label htmlFor="query">CPF, e-mail, conta ou nome</Label>
          <Input
            id="query"
            name="query"
            minLength={3}
            maxLength={120}
            autoComplete="off"
            // The page exists to search, and the home's "Buscar cliente" leads here (home plan, H4).
            autoFocus
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          <Search aria-hidden="true" />
          {pending ? 'Buscando…' : 'Buscar'}
        </Button>
      </form>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.result ? (
        <section aria-label="Resultados" className="space-y-3">
          {state.result.customers.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <Card className="py-2">
              <CardContent className="divide-y px-2">
                {state.result.customers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="flex items-center gap-4 rounded-md px-3 py-3 hover:bg-accent"
                  >
                    <span className="flex-1">
                      <span className="block font-semibold">{customer.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {customer.cpfMasked} · {customer.account.branch} · {customer.account.number}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
          {state.result.truncated ? (
            <p className="text-sm text-muted-foreground">Mais de 20 resultados: refine a busca.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
