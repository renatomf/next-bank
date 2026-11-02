import { ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { READS_CUSTOMERS, ROLE_LABELS, signedInMember } from '@/lib/backend';

/** The staff's home: who is signed in, and where their role may go. */
export default async function HomePage() {
  const member = await signedInMember();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {member.name}</h1>
        <p className="text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</p>
      </div>
      {READS_CUSTOMERS.includes(member.role) ? (
        <Link href="/clientes" className="block max-w-sm">
          <Card className="transition-colors hover:bg-accent">
            <CardContent className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-secondary text-link">
                <Users aria-hidden="true" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">Clientes</span>
                <span className="block text-sm text-muted-foreground">Busca, ficha e extrato</span>
              </span>
              <ChevronRight aria-hidden="true" className="text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ) : null}
    </div>
  );
}
