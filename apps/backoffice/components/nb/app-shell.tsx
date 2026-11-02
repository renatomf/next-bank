import { LogOut } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Theme } from '@/lib/theme';
import { Logo } from './logo';
import { ThemeSwitcher } from './theme-switcher';

export interface ShellLink {
  href: string;
  label: string;
}

/**
 * The frame of every page after the login: the brand, what the member's role
 * may open, the theme and the way out. The links only spare a 403; the API
 * decides what each role reads.
 */
export function AppShell({
  member,
  links,
  theme,
  logout,
  children,
}: {
  member: { name: string; roleLabel: string };
  links: readonly ShellLink[];
  theme: Theme;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,var(--nb-glow),transparent_60%)]">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-2xl">
            <Logo />
            <span className="sr-only">Início</span>
          </Link>
          <nav aria-label="Principal" className="flex gap-4 text-sm font-semibold">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-link hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-right text-sm leading-tight">
              <span className="block font-semibold">{member.name}</span>
              <span className="block text-muted-foreground">{member.roleLabel}</span>
            </span>
            <ThemeSwitcher current={theme} />
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut aria-hidden="true" />
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
