'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { sidebarCookie } from '@/lib/sidebar';
import { cn } from '@/lib/utils';
import { Logo, LogoMark } from './logo';
import { SidebarNav } from './sidebar-nav';

/** One size for every control of the sidebar: a 40 px box, its icon centered. */
const CONTROL =
  'grid size-10 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none';

/**
 * The left sidebar of the desktop (task 3.5): open with icons and names,
 * collapsed to the icons alone. Collapsed, the brand at the top turns into
 * the button that opens it, on hover or keyboard focus; open, the logo goes
 * home and the button beside it closes the sidebar. It starts as the server
 * rendered it, from the member's cookie, and a click keeps the choice.
 */
export function AppSidebar({ role, collapsed: initial }: { role: string; collapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  const pathname = usePathname();

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
        collapsed ? 'w-16 items-center px-3' : 'w-60 px-3',
      )}
    >
      <TooltipProvider delayDuration={200}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggle}
                aria-label="Abrir menu"
                aria-expanded={false}
                className={cn(CONTROL, 'group')}
              >
                <LogoMark className="group-hover:hidden group-focus-visible:hidden" />
                <PanelLeftOpen
                  aria-hidden="true"
                  className="hidden size-[18px] group-hover:block group-focus-visible:block"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Abrir menu</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Início" className="pl-3 text-2xl">
              <Logo />
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Fechar menu"
                  aria-expanded
                  className={CONTROL}
                >
                  <PanelLeftClose aria-hidden="true" className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Fechar menu</TooltipContent>
            </Tooltip>
          </div>
        )}
      </TooltipProvider>
      <SidebarNav role={role} currentPath={pathname} collapsed={collapsed} />
    </aside>
  );
}
