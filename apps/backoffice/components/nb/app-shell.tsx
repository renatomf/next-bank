import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './app-sidebar';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { ThemeToggle } from './theme-toggle';

/**
 * The frame of every page after the login (task 3.5): the sidebar on the
 * left, collapsible to icons; a header with the theme, the member and the
 * way out; on a phone, a drawer with all of it. The pages the sidebar
 * offers only spare a 403: the API decides what each role reads.
 */
export function AppShell({
  member,
  sidebarCollapsed,
  logout,
  children,
}: {
  member: { name: string; role: string; roleLabel: string };
  sidebarCollapsed: boolean;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const who = (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-semibold">{member.name}</span>
      <Badge variant="secondary">{member.roleLabel}</Badge>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <AppSidebar role={member.role} collapsed={sidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <MobileNav
            role={member.role}
            member={who}
            themeToggle={<ThemeToggle />}
            logout={logout}
          />
          <span className="text-xl lg:hidden">
            <Logo />
          </span>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <div className="flex items-center gap-2 border-l pl-3">
              {who}
              <form action={logout}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Sair">
                  <LogOut aria-hidden="true" />
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 bg-[radial-gradient(ellipse_at_top,var(--nb-glow),transparent_60%)] px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
