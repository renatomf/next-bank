'use client';

import { LogOut, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Logo } from './logo';
import { SidebarNav } from './sidebar-nav';

/**
 * Below the desktop width the sidebar becomes a drawer from the left, with
 * the member, the theme and the way out inside: a phone's header has no
 * room for them (task 3.5).
 */
export function MobileNav({
  role,
  member,
  themeToggle,
  logout,
}: {
  role: string;
  member: ReactNode;
  themeToggle: ReactNode;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Abrir menu">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-6 px-3 py-4">
        <SheetTitle className="px-3 text-2xl">
          <Logo />
        </SheetTitle>
        <SheetDescription className="sr-only">Navegação do backoffice</SheetDescription>
        <SidebarNav
          role={role}
          currentPath={pathname}
          collapsed={false}
          onNavigate={() => {
            setOpen(false);
          }}
        />
        <div className="mt-auto flex flex-col gap-3 border-t px-3 pt-4">
          {member}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Tema</span>
            {themeToggle}
          </div>
          <form action={logout}>
            <Button type="submit" variant="secondary" className="w-full justify-start">
              <LogOut aria-hidden="true" />
              Sair
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
