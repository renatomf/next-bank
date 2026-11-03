import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { navigationFor } from '@/components/nb/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ROLE_LABELS, signedInMember } from '@/lib/backend';

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/customers': 'Busca, ficha e extrato',
  '/requests': 'Desbloqueios, estornos e resoluções que pedem outra pessoa',
  '/reconciliation': 'O que a conciliação diária encontrou',
  '/staff': 'Membros, papéis e acessos',
  '/audit': 'Quem fez o quê e quando',
};

/** The staff's home: who is signed in, and a shortcut to each page the role may open. */
export default async function HomePage() {
  const member = await signedInMember();
  const shortcuts = navigationFor(member.role).filter((item) => item.href !== '/');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {member.name}</h1>
        <p className="text-muted-foreground">{ROLE_LABELS[member.role] ?? member.role}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-selected text-link">
                  <Icon aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-muted-foreground">{DESCRIPTIONS[href]}</span>
                </span>
                <ChevronRight aria-hidden="true" className="text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
