'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { sidebarCookie } from '@/lib/sidebar';
import { cn } from '@/lib/utils';
import { Logo, LogoMark } from './logo';
import { SidebarNav } from './sidebar-nav';

/**
 * The left sidebar of the desktop (task 3.5): open with icons and names,
 * collapsed to the icons alone. It starts as the server rendered it, from
 * the member's cookie, and a click flips it at once and keeps the choice.
 */
export function AppSidebar({ role, collapsed: initial }: { role: string; collapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  const pathname = usePathname();
  const label = collapsed ? 'Expandir menu' : 'Recolher menu';

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A screen preference the server reads on the next page (E7).
    document.cookie = sidebarCookie(next);
  }

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r bg-card py-4 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex',
        collapsed ? 'w-16 items-center px-2' : 'w-60 px-3',
      )}
    >
      <div
        className={cn('flex items-center', collapsed ? 'flex-col gap-4' : 'justify-between pl-3')}
      >
        <Link href="/" aria-label="Início" className="text-2xl">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                aria-label={label}
                aria-expanded={!collapsed}
                className="text-muted-foreground"
              >
                {collapsed ? (
                  <PanelLeftOpen aria-hidden="true" />
                ) : (
                  <PanelLeftClose aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <SidebarNav role={role} currentPath={pathname} collapsed={collapsed} />
    </aside>
  );
}
