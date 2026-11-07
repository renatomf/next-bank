import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { navigationFor } from '@/components/nb/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AwaitingDecision } from '@/features/home/awaiting-decision';
import { greetingOf } from '@/features/home/greeting';
import { type Home, loadHome } from '@/features/home/load-home';
import { MyRequests } from '@/features/home/my-requests';
import { countOf, waitingSummary } from '@/features/home/queue';
import { ReconciliationSummary } from '@/features/home/reconciliation-summary';
import { asSignedInMember, ROLE_LABELS, signedInMember } from '@/lib/backend';

const DESCRIPTIONS: Readonly<Record<string, string>> = {
  '/staff': 'Membros, papéis e acessos',
  '/audit': 'Quem fez o quê e quando',
};

/**
 * The staff's home (home plan): what waits for the member now, by role. The
 * analyst's queue, the operator's own requests, the reconciliation's open
 * exceptions; the admin keeps the shortcuts (H5).
 */
export default async function HomePage() {
  const member = await signedInMember();
  const home = await asSignedInMember((api) => loadHome(api, member.role));
  const now = new Date();
  const { salutation, date } = greetingOf(now);
  const summary = home.awaiting?.ok ? waitingSummary(countOf(home.awaiting.value)) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {salutation}, {member.name}
          </h1>
          <p className="text-muted-foreground">
            {ROLE_LABELS[member.role] ?? member.role} · {date}
          </p>
          {summary ? <p className="mt-1 font-semibold">{summary}</p> : null}
        </div>
        {home.mine ? (
          <Button asChild>
            <Link href="/customers">
              <Search aria-hidden="true" />
              Buscar cliente
            </Link>
          </Button>
        ) : null}
      </div>
      {hasBlocks(home) ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {home.awaiting ? (
            <AwaitingDecision loaded={home.awaiting} now={now} className="lg:col-span-2" />
          ) : null}
          {home.mine ? <MyRequests loaded={home.mine} now={now} className="lg:col-span-2" /> : null}
          {home.exceptions ? <ReconciliationSummary loaded={home.exceptions} /> : null}
        </div>
      ) : (
        <Shortcuts role={member.role} />
      )}
    </div>
  );
}

function hasBlocks(home: Home): boolean {
  return Object.keys(home).length > 0;
}

/** The pages the role may open, for a role with no blocks yet (H5). */
function Shortcuts({ role }: { role: string }) {
  const shortcuts = navigationFor(role).filter((item) => item.href !== '/');
  return (
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
  );
}
